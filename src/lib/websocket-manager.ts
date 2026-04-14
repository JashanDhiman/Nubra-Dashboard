/**
 * Nubra WebSocket Manager
 * DATA-02: WebSocket for real-time streaming
 * DATA-03: Greeks WebSocket channel for OI data
 * DATA-05: Bulk subscriptions (up to 10,000 instruments)
 * OPS-02: Reconnection logic with health checks and subscription restoration
 * OPS-03: Resource management — prevent file descriptor leaks
 * PROC-01: Real-time tick processing (exchange timestamps in nanoseconds)
 */

import { WsMode, WsTick } from '../types';
import {
  initNubraProto,
  decodeOptionChainUpdate,
} from './nubra-proto';

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

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  // ── Connect with WS auth token ────────────────────────────────────────────
  async connect(token: string): Promise<void> {
    if (this.isConnected()) {
      console.warn('[NubraWS] Already connected');
      return;
    }

    // Initialize protobuf schema
    await initNubraProto();

    this.wsToken = token;
    // Use the WebSocket URL provided during construction, append token as query parameter
    const wsUrlWithToken = `${this.wsUrl}?token=${token}`;
    this.doConnect(wsUrlWithToken);
  }

  private doConnect(url?: string): void {
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
      const connectUrl = url || this.wsUrl;
      console.log('[NubraWS] Connecting to WebSocket', connectUrl);
      this.ws = new WebSocket(connectUrl);
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
  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      // Get the raw data - could be string, ArrayBuffer, or Blob
      let rawData: string | Uint8Array;

      if (typeof event.data === 'string') {
        rawData = event.data;
        console.log('[NubraWS] Received string data, length:', rawData.length);
      } else if (event.data instanceof ArrayBuffer) {
        rawData = new Uint8Array(event.data);
        console.log('[NubraWS] Received ArrayBuffer, length:', rawData.length);

        // Check if it's actually text data disguised as binary
        try {
          const decoded = decodeOptionChainUpdate(rawData as Uint8Array);
          rawData = decoded;
        } catch (decodeError) {
          console.log(
            '[NubraWS] Could not decode ArrayBuffer as option chain:',
            decodeError
          );
        }
      } else {
        console.warn('[NubraWS] Unknown data type:', typeof event.data);
        return;
      }

      console.log('[NubraWS] Final data type for processing:', rawData);

      // For string messages (auth, control messages)
      if (typeof rawData === 'string') {
        const message = rawData;
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

        // Check for subscription responses
        if (
          message.includes('subscribed') ||
          message.includes('subscription') ||
          message.includes('post_market')
        ) {
          console.log('[NubraWS] Subscription confirmed');
          return;
        } else if (message.includes('error')) {
          console.error('[NubraWS] Error message:', message);
          this.setStatus('error');
          return;
        }
      }

      // For binary data (protobuf messages) or unhandled string messages
      this.parseDataMessage(rawData);
    } catch (err) {
      console.error('[NubraWS] Message parse error:', err);
    }
  }

  private parseDataMessage(message: any): void {
    try {
      let parsedData;

      // Handle string data (JSON format)
      if (typeof message === 'string') {
        console.log('[NubraWS] Parsing string message as JSON:', message);
        parsedData = message;
      } else {
        // Handle binary data (protobuf)
        parsedData = message;
        console.log('[NubraWS] Processing binary/protobuf data:', parsedData);
      }

      // Convert to our WsTick format
      const ticks = this.convertNubraToTicks(parsedData);
      console.log('[NubraWS] Converted to ticks:', ticks.length, 'ticks');
      if (ticks.length > 0) {
        console.log(
          '[NubraWS] Calling tick handlers with',
          ticks.length,
          'ticks'
        );
        console.log('[NubraWS] Sample tick:', ticks[0]);
        this.tickHandlers.forEach(handler => handler(ticks));
      } else {
        console.log('[NubraWS] No ticks to send to handlers');
      }
    } catch (err) {
      console.error('[NubraWS] Data parsing error:', err);
    }
  }

  private convertNubraToTicks(data: any): WsTick[] {
    // Convert Nubra's option chain format to our WsTick format
    const ticks: WsTick[] = [];

    console.log('[NubraWS] convertNubraToTicks called with data:', data);
    console.log('[NubraWS] Data type:', typeof data);
    console.log('[NubraWS] Data keys:', Object.keys(data));

    // Handle ce (call options) array
    if (data.ce && Array.isArray(data.ce)) {
      console.log(`[NubraWS] Found ce array with ${data.ce.length} items`);
      data.ce.forEach((item: any, index: number) => {
        const instrumentToken =
          item.inst_id ||
          item.instrument_token ||
          item.token ||
          item.id ||
          item.refId;
        if (!instrumentToken) {
          console.warn(
            `[NubraWS] ce[${index}] missing instrument token:`,
            item
          );
          return;
        }
        ticks.push({
          instrument_token: instrumentToken.toString(),
          mode: 'full',
          tradable: true,
          exchange_timestamp:
            item.ts || item.exchange_timestamp || Date.now() * 1_000_000,
          last_trade_time: item.ts || item.last_trade_time || Date.now(),
          ltp: item.ltp || item.last_price || item.price || 0,
          bid: item.bid || 0,
          ask: item.ask || 0,
          volume: item.volume || item.vol || 0,
          oi: item.oi || item.open_interest || 0,
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

    // Handle pe (put options) array
    if (data.pe && Array.isArray(data.pe)) {
      console.log(`[NubraWS] Found pe array with ${data.pe.length} items`);
      data.pe.forEach((item: any, index: number) => {
        const instrumentToken =
          item.inst_id ||
          item.instrument_token ||
          item.token ||
          item.id ||
          item.refId;
        if (!instrumentToken) {
          console.warn(
            `[NubraWS] pe[${index}] missing instrument token:`,
            item
          );
          return;
        }
        ticks.push({
          instrument_token: instrumentToken.toString(),
          mode: 'full',
          tradable: true,
          exchange_timestamp:
            item.ts || item.exchange_timestamp || Date.now() * 1_000_000,
          last_trade_time: item.ts || item.last_trade_time || Date.now(),
          ltp: item.ltp || item.last_price || item.price || 0,
          bid: item.bid || 0,
          ask: item.ask || 0,
          volume: item.volume || item.vol || 0,
          oi: item.oi || item.open_interest || 0,
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

    // Handle single tick format (fallback)
    if (ticks.length === 0) {
      const instrumentToken =
        data.instrument_token ||
        data.inst_id ||
        data.token ||
        data.id ||
        data.refId;
      if (instrumentToken) {
        console.log('[NubraWS] Processing as single tick:', data);
        ticks.push({
          instrument_token: instrumentToken.toString(),
          mode: 'full',
          tradable: true,
          exchange_timestamp:
            data.exchange_timestamp || data.ts || Date.now() * 1_000_000,
          last_trade_time: data.last_trade_time || data.ts || Date.now(),
          ltp: data.ltp || data.last_price || data.price || 0,
          bid: data.bid || 0,
          ask: data.ask || 0,
          volume: data.volume || data.vol || 0,
          oi: data.oi || data.open_interest || 0,
          greeks: data.iv
            ? {
                iv: data.iv,
                delta: data.delta,
                gamma: data.gamma,
                theta: data.theta,
                vega: data.vega,
              }
            : undefined,
        });
      } else {
        console.warn(
          '[NubraWS] Single tick data missing instrument token:',
          data
        );
      }
    }

    console.log('[NubraWS] Total ticks created:', ticks.length);

    // Debug: If no ticks created, show why
    if (ticks.length === 0) {
      console.log('[NubraWS] No ticks created - debugging data structure:');
      console.log('[NubraWS] - has ce array:', !!data.ce);
      console.log('[NubraWS] - ce is array:', Array.isArray(data.ce));
      console.log('[NubraWS] - ce length:', data.ce?.length);
      console.log('[NubraWS] - has pe array:', !!data.pe);
      console.log('[NubraWS] - pe is array:', Array.isArray(data.pe));
      console.log('[NubraWS] - pe length:', data.pe?.length);
      console.log(
        '[NubraWS] - has instrument_token fallback:',
        !!(
          data.instrument_token ||
          data.inst_id ||
          data.token ||
          data.id ||
          data.refId
        )
      );

      // Try to see if data is nested under a property
      if (data.data && typeof data.data === 'object') {
        console.log('[NubraWS] Found nested data property:');
        console.log('[NubraWS] - data.data keys:', Object.keys(data.data));
        console.log('[NubraWS] - data.data has ce:', !!data.data.ce);
        console.log('[NubraWS] - data.data has pe:', !!data.data.pe);
      }

      // Log the entire data structure for inspection
      //console.log(
      //  '[NubraWS] Full data structure:',
      //  JSON.stringify(data, null, 2)
      //);
    }

    return ticks;
  }

  // ── Subscribe / Unsubscribe ───────────────────────────────────────────────
  // DATA-05: Bulk subscription support
  subscribeOptionChain(exchange: string, asset: string, expiry: string): void {
    const subscriptionKey = `${exchange}-${asset}-${expiry}`;
    this.optionSubscriptions.add(subscriptionKey);

    console.log('[NubraWS] subscribeOptionChain called:', {
      exchange,
      asset,
      expiry,
      wsReadyState: this.ws?.readyState,
      wsToken: this.wsToken ? 'present' : 'missing',
      wsConnected: this.ws?.readyState === WebSocket.OPEN,
    });

    if (this.ws?.readyState === WebSocket.OPEN && this.wsToken) {
      //const postMarketMessage = `batch_subscribe ${this.wsToken} post_market true`;
      //console.log('[NubraWS] Enabling post-market mode for testing');
      //this.ws.send(postMarketMessage);
      // Use actual token in subscription messages
      const intervalMessage = `batch_subscribe ${this.wsToken} socket_interval option 1s`;
      const optionMessage = `batch_subscribe ${this.wsToken} option [{"exchange":"${exchange}","asset":"${asset}","expiry":"${expiry}"}]`;
      console.log(
        '[NubraWS] Subscribing to option chain with message:',
        optionMessage
      );
      this.ws.send(intervalMessage);
      this.ws.send(optionMessage);
    } else {
      console.warn(
        '[NubraWS] Cannot subscribe - WebSocket not ready or token missing'
      );
    }
  }

  // Enable post-market mode for testing when markets are closed
  enablePostMarketMode(): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.wsToken) {
      const message = `batch_subscribe ${this.wsToken} post_market true`;
      console.log('[NubraWS] Enabling post-market mode for testing');
      this.ws.send(message);
    } else {
      console.warn(
        '[NubraWS] Cannot enable post-market mode - WebSocket not connected'
      );
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

  isConnected(): boolean {
    return this.status === 'connected';
  }

  // OPS-03: Clean disconnect — prevent file descriptor leaks
  disconnect(): void {
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
