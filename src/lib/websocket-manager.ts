/**
 * Nubra WebSocket Manager
 * DATA-02: WebSocket for real-time streaming
 * DATA-03: Greeks WebSocket channel for OI data
 * DATA-05: Bulk subscriptions (up to 10,000 instruments)
 * OPS-02: Reconnection logic with health checks and subscription restoration
 * OPS-03: Resource management — prevent file descriptor leaks
 * PROC-01: Real-time tick processing (exchange timestamps in nanoseconds)
 */

import { WsTick, WsMode, WsServerMessage } from '@/types';

type TickHandler = (ticks: WsTick[]) => void;
type StatusHandler = (status: WSStatus) => void;

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export class NubraWebSocketManager {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private wsToken: string | null = null;

  private optionSubscriptions: Set<string> = new Set(); // Store option chain subscriptions
  private greeksSubscriptions: Set<string> = new Set(); // Store Greeks subscriptions
  private tickHandlers: Set<TickHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();

  private status: WSStatus = 'disconnected';
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
    // Prevent reconnection if already connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[NubraWS] Already connected, skipping connection attempt');
      return;
    }

    this.wsToken = wsToken;
    // Use correct Nubra WebSocket endpoint format with token as query parameter
    this.wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'wss://uatapi.nubra.io/apibatch/ws'}?token=${wsToken}`;
    this.doConnect();
  }

  private doConnect(): void {
    // Prevent duplicate connections
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      console.log('[NubraWS] Connection already in progress or established');
      return;
    }

    this.setStatus('connecting');

    try {
      console.log('[NubraWS] Connecting to WebSocket', process.env.NEXT_PUBLIC_WS_URL);
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          console.error('[NubraWS] Connection timeout - forcing close');
          this.ws.close(1006, 'Connection timeout');
        }
      }, 10000); // 10 second timeout

      this.ws.onopen = () => {
        // Clear connection timeout
        if (typeof connectionTimeout !== 'undefined') {
          clearTimeout(connectionTimeout);
        }

        this.reconnectAttempts = 0;
        this.setStatus('connected');
        // Disable heartbeat for now - Nubra may not support standard ping/pong
        // this.startHeartbeat();

        // Wait a moment before sending subscriptions to ensure connection is stable
        setTimeout(() => {
          this.restoreSubscriptions(); // OPS-02: restore on reconnect
          console.log(
            '[NubraWS] WebSocket connected and subscriptions restored'
          );
        }, 100);
      };

      this.ws.onmessage = event => {
        this.handleMessage(event);
      };

      this.ws.onerror = error => {
        console.error('[NubraWS] WebSocket error:', error);
        this.setStatus('error');
      };

      this.ws.onclose = event => {
        console.log('[NubraWS] WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          readyState: this.ws?.readyState,
        });

        // Log specific close codes for debugging
        if (event.code === 1002 || event.code === 1003) {
          console.error(
            '[NubraWS] Protocol error - invalid authentication or message format'
          );
        } else if (event.code === 1008) {
          console.error(
            '[NubraWS] Policy violation - invalid token or permissions'
          );
        } else if (event.code === 1006) {
          console.error(
            '[NubraWS] Connection closed abnormally - possible network issue'
          );
        }

        this.stopHeartbeat();
        if (typeof connectionTimeout !== 'undefined') {
          clearTimeout(connectionTimeout);
        }
        if (!event.wasClean) {
          console.log('[NubraWS] Unclean disconnect, scheduling reconnect...');
          this.scheduleReconnect();
        } else {
          this.setStatus('disconnected');
        }
      };
    } catch (err) {
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  // ── Message handling ──────────────────────────────────────────────────────
  private handleMessage(event: MessageEvent): void {
    try {
      // Nubra sends binary data (protobuf) or text messages
      const message =
        typeof event.data === 'string'
          ? event.data
          : new TextDecoder('utf-8').decode(event.data);
      console.log('[NubraWS] Received message:', message);

      // Check for authentication responses
      if (message.includes('auth') || message.includes('token')) {
        if (message.includes('success') || message.includes('connected')) {
          console.log('[NubraWS] Authentication successful');
        } else if (message.includes('error') || message.includes('invalid')) {
          console.error('[NubraWS] Authentication failed:', message);
          this.setStatus('error');
          return;
        }
      }

      // Parse Nubra's message format
      // Messages can be subscription responses, data updates, or control messages
      if (
        message.includes('option') ||
        message.includes('greeks') ||
        message.includes('orderbook')
      ) {
        // This is likely a data message - parse accordingly
        this.parseDataMessage(message);
      } else if (message.includes('connected') || message.includes('success')) {
        console.log('[NubraWS] Subscription confirmed');
      } else if (message.includes('error')) {
        console.error('[NubraWS] Error message:', message);
        this.setStatus('error');
      }
    } catch (err) {
      console.error('[NubraWS] Message parse error:', err);
    }
  }

  private parseDataMessage(message: string): void {
    // For now, try to parse as JSON - in production this should handle protobuf
    try {
      const data = JSON.parse(message);
      // Convert Nubra format to our WsTick format
      const ticks = this.convertNubraToTicks(data);
      if (ticks.length > 0) {
        this.tickHandlers.forEach(handler => handler(ticks));
      }
    } catch (err) {
      console.log('[NubraWS] Non-JSON message, likely protobuf data');
      // TODO: Implement protobuf parsing when needed
    }
  }

  private convertNubraToTicks(data: any): WsTick[] {
    // Convert Nubra's option chain format to our WsTick format
    const ticks: WsTick[] = [];

    if (data.ce && Array.isArray(data.ce)) {
      data.ce.forEach((item: any) => {
        ticks.push({
          instrument_token: item.inst_id?.toString(),
          mode: 'full',
          tradable: true,
          exchange_timestamp: item.ts || Date.now() * 1_000_000,
          last_trade_time: item.ts || Date.now(),
          ltp: item.ltp || 0,
          bid: 0,
          ask: 0,
          volume: item.volume || 0,
          oi: item.oi || 0,
          greeks: item.iv
            ? {
                iv: item.iv,
                delta: item.delta,
                gamma: item.gamma,
                theta: item.theta,
                vega: item.vega,
              }
            : undefined,
        });
      });
    }

    if (data.pe && Array.isArray(data.pe)) {
      data.pe.forEach((item: any) => {
        ticks.push({
          instrument_token: item.inst_id?.toString(),
          mode: 'full',
          tradable: true,
          exchange_timestamp: item.ts || Date.now() * 1_000_000,
          last_trade_time: item.ts || Date.now(),
          ltp: item.ltp || 0,
          bid: 0,
          ask: 0,
          volume: item.volume || 0,
          oi: item.oi || 0,
          greeks: item.iv
            ? {
                iv: item.iv,
                delta: item.delta,
                gamma: item.gamma,
                theta: item.theta,
                vega: item.vega,
              }
            : undefined,
        });
      });
    }

    return ticks;
  }

  // PROC-01: Normalize exchange timestamps from nanoseconds
  private processTick = (tick: WsTick): WsTick => ({
    ...tick,
    exchange_timestamp: Math.floor(tick.exchange_timestamp / 1_000_000), // ns → ms
  });

  // ── Binary protocol decode (Nubra uses compact binary for performance) ────
  private decodeBinary(buffer: ArrayBuffer): WsServerMessage {
    const text = new TextDecoder('utf-8').decode(buffer);
    return JSON.parse(text);
  }

  // ── Subscribe / Unsubscribe ───────────────────────────────────────────────
  // DATA-05: Bulk subscription support
  subscribeOptionChain(exchange: string, asset: string, expiry: string): void {
    const subscriptionKey = `${exchange}-${asset}-${expiry}`;
    this.optionSubscriptions.add(subscriptionKey);

    if (this.ws?.readyState === WebSocket.OPEN && this.wsToken) {
      // Use actual token in subscription messages
      const message = `batch_subscribe ${this.wsToken} option [{"exchange":"${exchange}","asset":"${asset}","expiry":"${expiry}"}]`;
      console.log('[NubraWS] Subscribing to option chain');
      this.ws.send(message);
    }
  }

  subscribeGreeks(instrumentTokens: string[]): void {
    instrumentTokens.forEach(token => this.greeksSubscriptions.add(token));

    if (this.ws?.readyState === WebSocket.OPEN && this.wsToken) {
      const tokensJson = JSON.stringify({
        instruments: instrumentTokens.map(Number),
      });
      // Use actual token in subscription messages
      const message = `batch_subscribe ${this.wsToken} greeks ${tokensJson}`;
      console.log('[NubraWS] Subscribing to Greeks:');
      this.ws.send(message);
    }
  }

  unsubscribeOptionChain(
    exchange: string,
    asset: string,
    expiry: string
  ): void {
    const subscriptionKey = `${exchange}-${asset}-${expiry}`;
    this.optionSubscriptions.delete(subscriptionKey);

    if (this.ws?.readyState === WebSocket.OPEN && this.wsToken) {
      const message = `batch_unsubscribe ${this.wsToken} option [{"exchange":"${exchange}","asset":"${asset}","expiry":"${expiry}"}]`;
      console.log('[NubraWS] Unsubscribing from option chain');
      this.ws.send(message);
    }
  }

  unsubscribeGreeks(instrumentTokens: string[]): void {
    instrumentTokens.forEach(token => this.greeksSubscriptions.delete(token));

    if (this.ws?.readyState === WebSocket.OPEN && this.wsToken) {
      const tokensJson = JSON.stringify({
        instruments: instrumentTokens.map(Number),
      });
      const message = `batch_unsubscribe ${this.wsToken} greeks ${tokensJson}`;
      console.log('[NubraWS] Unsubscribing from Greeks');
      this.ws.send(message);
    }
  }

  // Legacy methods for backward compatibility
  subscribe(tokens: string[], mode: WsMode = 'full'): void {
    console.warn(
      '[NubraWS] Legacy subscribe() called, use subscribeOptionChain() or subscribeGreeks() instead'
    );
    if (mode === 'greeks') {
      this.subscribeGreeks(tokens);
    }
  }

  unsubscribe(tokens: string[], mode?: WsMode): void {
    console.warn(
      '[NubraWS] Legacy unsubscribe() called, use unsubscribeOptionChain() or unsubscribeGreeks() instead'
    );
    if (mode === 'greeks') {
      this.unsubscribeGreeks(tokens);
    }
  }

  // OPS-02: Restore all subscriptions after reconnect
  private restoreSubscriptions(): void {
    // Restore option chain subscriptions
    this.optionSubscriptions.forEach(subscription => {
      const [exchange, asset, expiry] = subscription.split('-');
      this.subscribeOptionChain(exchange, asset, expiry);
    });

    // Restore Greeks subscriptions
    if (this.greeksSubscriptions.size > 0) {
      this.subscribeGreeks(Array.from(this.greeksSubscriptions));
    }
  }

  // ── Send helper ───────────────────────────────────────────────────────────
  private send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[NubraWS] Sending message:', message);
      this.ws.send(message);
    } else {
      console.warn('[NubraWS] Cannot send message, WebSocket not connected');
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Nubra may not use standard ping, could be a control message
        this.send('ping');
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
      console.error('[NubraWS] Max reconnection attempts reached');
      this.setStatus('error');
      return;
    }

    // Increase minimum delay to prevent rapid cycling
    const delay = Math.max(
      2000,
      Math.min(1000 * 2 ** this.reconnectAttempts, 30_000)
    );
    this.reconnectAttempts++;

    console.log(
      `[NubraWS] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );
    this.setStatus('connecting');

    this.reconnectTimer = setTimeout(() => {
      console.log('[NubraWS] Attempting reconnection...');
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
    this.statusHandlers.forEach(h => h(status));
  }

  getStatus(): WSStatus {
    return this.status;
  }

  // OPS-03: Clean disconnect — prevent file descriptor leaks
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.optionSubscriptions.clear();
    this.greeksSubscriptions.clear();
    this.tickHandlers.clear();
    this.statusHandlers.clear();

    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect loop
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('disconnected');
    console.log('[NubraWS] Disconnected');
  }
}
