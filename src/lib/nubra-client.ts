/**
 * Nubra API Client
 * AUTH-01 → AUTH-04: Secure MPIN-based auth, session token management, proactive refresh
 * DATA-01: REST API for option chain snapshots
 * OPS-01: Rate limiting (60 req/min for REST)
 * OPS-04: 429 throttling with backoff
 */

import {
  NubraAuthResponse,
  OptionChainSnapshot,
  PlaceOrderRequest,
  PlaceOrderResponse,
  Order,
} from "@/types";

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
class RateLimiter {
  private queue: number[] = [];
  private readonly maxPerMinute: number;

  constructor(maxPerMinute = 60) {
    this.maxPerMinute = maxPerMinute;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    this.queue = this.queue.filter((t) => now - t < 60_000);
    if (this.queue.length >= this.maxPerMinute) {
      const wait = 60_000 - (now - this.queue[0]);
      await new Promise((r) => setTimeout(r, wait));
    }
    this.queue.push(Date.now());
  }
}

// ─── Session Manager ──────────────────────────────────────────────────────────
class SessionManager {
  private token: string | null = null;
  private expiresAt: Date | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  setSession(token: string, expiresAt: string): void {
    this.token = token;
    this.expiresAt = new Date(expiresAt);
    this.scheduleRefresh();
  }

  getToken(): string | null {
    return this.token;
  }

  isValid(): boolean {
    if (!this.token || !this.expiresAt) return false;
    // Consider expired 5 minutes early (AUTH-03: proactive refresh)
    return this.expiresAt.getTime() - Date.now() > 5 * 60 * 1000;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (!this.expiresAt) return;
    // Refresh 10 minutes before expiry
    const delay = this.expiresAt.getTime() - Date.now() - 10 * 60 * 1000;
    if (delay > 0) {
      this.refreshTimer = setTimeout(() => {
        nubraClient.refreshSession().catch(console.error);
      }, delay);
    }
  }

  clear(): void {
    this.token = null;
    this.expiresAt = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }
}

// ─── Nubra API Client ─────────────────────────────────────────────────────────
class NubraClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly mpin: string;
  private readonly rateLimiter: RateLimiter;
  public readonly session: SessionManager;

  constructor() {
    this.baseUrl = process.env.NUBRA_BASE_URL || "https://api.nubra.in/v1";
    this.apiKey = process.env.NUBRA_API_KEY || "";
    this.mpin = process.env.NUBRA_MPIN || "";
    this.rateLimiter = new RateLimiter(60);
    this.session = new SessionManager();
  }

  // ── Internal fetch with auth headers, retry on 429 ──────────────────────
  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    retries = 3
  ): Promise<T> {
    await this.rateLimiter.throttle();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // AUTH-02: Include session token in Authorization header
    const token = this.session.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    // OPS-04: Handle 429 with exponential backoff
    if (res.status === 429 && retries > 0) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.fetch<T>(path, options, retries - 1);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new NubraAPIError(res.status, body?.message || res.statusText, path);
    }

    return res.json() as Promise<T>;
  }

  // ── AUTH-01: MPIN-based authentication ────────────────────────────────────
  async authenticate(): Promise<NubraAuthResponse> {
    if (!this.apiKey || !this.mpin) {
      throw new Error("NUBRA_API_KEY and NUBRA_MPIN must be set in environment variables");
    }

    console.log("[Auth] POSTing to", `${this.baseUrl}/auth/login`, "with client_id:", this.apiKey);

    let res: NubraAuthResponse;
    try {
      res = await this.fetch<NubraAuthResponse>("/totp/login", {
        method: "POST",
        body: JSON.stringify({ client_id: this.apiKey, mpin: this.mpin }),
      });
    } catch (err: unknown) {
      const cause = (err as { cause?: unknown })?.cause;
      console.error("[Auth] fetch failed →", err instanceof Error ? err.message : err);
      if (cause) console.error("[Auth] underlying cause →", cause);
      throw err;
    }

    console.log("[Auth] login response:", res);

    if (res.status === "success" && res.session_token) {
      this.session.setSession(res.session_token, res.expires_at);
    }

    return res;
  }

  // AUTH-03: Proactive token refresh
  async refreshSession(): Promise<void> {
    await this.authenticate();
  }

  // ── Ensure authenticated before making calls ──────────────────────────────
  async ensureAuth(): Promise<void> {
    if (!this.session.isValid()) {
      await this.authenticate();
    }
  }

  // ── DATA-01: Option chain snapshot ────────────────────────────────────────
  async getOptionChain(
    underlying: string,
    expiry: string
  ): Promise<OptionChainSnapshot> {
    await this.ensureAuth();
    return this.fetch<OptionChainSnapshot>(
      `/market/option-chain?underlying=${underlying}&expiry=${expiry}`
    );
  }

  // ── Expiry dates for an underlying ───────────────────────────────────────
  async getExpiries(underlying: string): Promise<string[]> {
    await this.ensureAuth();
    const res = await this.fetch<{ expiries: string[] }>(
      `/market/expiries?underlying=${underlying}`
    );
    return res.expiries;
  }

  // ── Place order (UI-07) ───────────────────────────────────────────────────
  async placeOrder(order: PlaceOrderRequest): Promise<PlaceOrderResponse> {
    await this.ensureAuth();
    return this.fetch<PlaceOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  // ── Order book ─────────────────────────────────────────────────────────────
  async getOrders(): Promise<Order[]> {
    await this.ensureAuth();
    const res = await this.fetch<{ orders: Order[] }>("/orders");
    return res.orders;
  }

  // ── WebSocket token (short-lived token for WS auth) ───────────────────────
  async getWsToken(): Promise<string> {
    await this.ensureAuth();
    const res = await this.fetch<{ ws_token: string }>("/auth/ws-token");
    return res.ws_token;
  }
}

// ─── Custom Error ─────────────────────────────────────────────────────────────
export class NubraAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public path: string
  ) {
    super(`NubraAPI [${statusCode}] ${path}: ${message}`);
    this.name = "NubraAPIError";
  }
}

// Singleton client (server-side only)
export const nubraClient = new NubraClient();
