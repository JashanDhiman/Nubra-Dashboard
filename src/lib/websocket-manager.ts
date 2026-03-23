/**
 * Nubra WebSocket Manager
 * DATA-02: WebSocket for real-time streaming
 * DATA-03: Greeks WebSocket channel for OI data
 * DATA-05: Bulk subscriptions (up to 10,000 instruments)
 * OPS-02: Reconnection logic with health checks and subscription restoration
 * OPS-03: Resource management — prevent file descriptor leaks
 * PROC-01: Real-time tick processing (exchange timestamps in nanoseconds)
 */

import { WsTick, WsMode, WsSubscribeMessage, WsServerMessage } from "@/types";

type TickHandler = (ticks: WsTick[]) => void;
type StatusHandler = (status: WSStatus) => void;

export type WSStatus = "connecting" | "connected" | "disconnected" | "error";

interface Subscription {
  tokens: Set<string>;
  mode: WsMode;
}

export class NubraWebSocketManager {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private wsToken: string | null = null;

  private subscriptions: Map<WsMode, Set<string>> = new Map();
  private tickHandlers: Set<TickHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();

  private status: WSStatus = "disconnected";
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatInterval = 25_000; // 25s ping

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  // ── Connect with WS auth token ────────────────────────────────────────────
  async connect(wsToken: string): Promise<void> {
    this.wsToken = wsToken;
    this.wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "wss://stream.nubra.in/v1/ws"}?token=${wsToken}`;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        this.startHeartbeat();
        this.restoreSubscriptions(); // OPS-02: restore on reconnect
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = () => {
        this.setStatus("error");
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        if (!event.wasClean) {
          this.scheduleReconnect();
        } else {
          this.setStatus("disconnected");
        }
      };
    } catch (err) {
      this.setStatus("error");
      this.scheduleReconnect();
    }
  }

  // ── Message handling ──────────────────────────────────────────────────────
  private handleMessage(event: MessageEvent): void {
    try {
      const msg: WsServerMessage =
        typeof event.data === "string"
          ? JSON.parse(event.data)
          : this.decodeBinary(event.data);

      if (msg.type === "ticks" && msg.data) {
        // PROC-01: Process ticks as they arrive
        const processed = msg.data.map(this.processTick);
        this.tickHandlers.forEach((handler) => handler(processed));
      }
    } catch (err) {
      console.error("[NubraWS] Message parse error:", err);
    }
  }

  // PROC-01: Normalize exchange timestamps from nanoseconds
  private processTick = (tick: WsTick): WsTick => ({
    ...tick,
    exchange_timestamp: Math.floor(tick.exchange_timestamp / 1_000_000), // ns → ms
  });

  // ── Binary protocol decode (Nubra uses compact binary for performance) ────
  private decodeBinary(buffer: ArrayBuffer): WsServerMessage {
    const text = new TextDecoder("utf-8").decode(buffer);
    return JSON.parse(text);
  }

  // ── Subscribe / Unsubscribe ───────────────────────────────────────────────
  // DATA-05: Bulk subscription support
  subscribe(tokens: string[], mode: WsMode = "full"): void {
    if (!this.subscriptions.has(mode)) {
      this.subscriptions.set(mode, new Set());
    }
    tokens.forEach((t) => this.subscriptions.get(mode)!.add(t));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "subscribe", tokens, mode });
    }
  }

  unsubscribe(tokens: string[], mode?: WsMode): void {
    if (mode) {
      tokens.forEach((t) => this.subscriptions.get(mode)?.delete(t));
    } else {
      this.subscriptions.forEach((set) => tokens.forEach((t) => set.delete(t)));
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "unsubscribe", tokens });
    }
  }

  // DATA-03: Subscribe specifically to Greeks channel
  subscribeGreeks(tokens: string[]): void {
    this.subscribe(tokens, "greeks");
  }

  // OPS-02: Restore all subscriptions after reconnect
  private restoreSubscriptions(): void {
    this.subscriptions.forEach((tokens, mode) => {
      if (tokens.size > 0) {
        this.send({ type: "subscribe", tokens: Array.from(tokens), mode });
      }
    });
  }

  // ── Send helper ───────────────────────────────────────────────────────────
  private send(msg: WsSubscribeMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Reconnect with exponential backoff ───────────────────────────────────
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("error");
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    this.setStatus("connecting");

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  onTick(handler: TickHandler): () => void {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private setStatus(status: WSStatus): void {
    this.status = status;
    this.statusHandlers.forEach((h) => h(status));
  }

  getStatus(): WSStatus {
    return this.status;
  }

  // OPS-03: Clean disconnect — prevent file descriptor leaks
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.subscriptions.clear();
    this.tickHandlers.clear();
    this.statusHandlers.clear();

    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect loop
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.setStatus("disconnected");
  }
}
