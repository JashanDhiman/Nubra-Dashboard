// ─── AUTH ────────────────────────────────────────────────────────────────────
export interface NubraAuthRequest {
  client_id: string;
  mpin: string;
}

export interface NubraAuthResponse {
  status: "success" | "error";
  session_token: string;
  expires_at: string;
  message?: string;
}

export interface SessionState {
  token: string | null;
  expiresAt: Date | null;
  isAuthenticated: boolean;
}

// ─── MARKET DATA ─────────────────────────────────────────────────────────────
export interface Greeks {
  iv: number;        // Implied Volatility (%)
  delta: number;     // Delta
  gamma: number;     // Gamma
  theta: number;     // Theta (daily)
  vega: number;      // Vega
}

export interface MarketDepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface MarketDepth {
  bids: MarketDepthLevel[];  // Up to 20 levels
  asks: MarketDepthLevel[];
}

export interface OptionLeg {
  instrument_token: string;
  trading_symbol: string;
  ltp: number;
  bid: number;
  ask: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  change_pct: number;
  volume: number;
  oi: number;
  oi_change: number;
  oi_change_pct: number;
  tick_volume: number;
  cumulative_volume: number;
  cumulative_volume_premium: number;
  greeks: Greeks;
  depth: MarketDepth;
  exchange_timestamp: number; // nanoseconds
}

export interface OptionChainRow {
  strike: number;
  call: OptionLeg;
  put: OptionLeg;
  isATM: boolean;
  pcr: number;           // Put-Call OI Ratio for this strike
  netOI: number;
  gex: number;           // Gamma Exposure at this strike
  maxPainWeight: number;
}

export interface OptionChainSnapshot {
  underlying: string;
  expiry: string;
  spot: number;
  spot_change: number;
  spot_change_pct: number;
  atm_strike: number;
  total_call_oi: number;
  total_put_oi: number;
  pcr: number;
  max_pain: number;
  iv_rank: number;       // IVR
  iv_percentile: number; // IVP
  rows: OptionChainRow[];
  timestamp: string;
}

// ─── WEBSOCKET TICK ──────────────────────────────────────────────────────────
export type WsMode = "ltp" | "quote" | "full" | "greeks";

export interface WsTick {
  instrument_token: string;
  mode: WsMode;
  tradable: boolean;
  exchange_timestamp: number;
  last_trade_time: number;
  ltp: number;
  bid?: number;
  ask?: number;
  volume?: number;
  oi?: number;
  greeks?: Greeks;
  depth?: MarketDepth;
}

export interface WsSubscribeMessage {
  type: "subscribe" | "unsubscribe" | "mode";
  tokens?: string[];
  mode?: WsMode;
}

export interface WsServerMessage {
  type: "ticks" | "connected" | "error" | "pong";
  data?: WsTick[];
  message?: string;
}

// ─── ORDER ───────────────────────────────────────────────────────────────────
export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";
export type ProductType = "MIS" | "NRML" | "CNC";
export type OrderStatus = "PENDING" | "OPEN" | "COMPLETE" | "REJECTED" | "CANCELLED";

export interface PlaceOrderRequest {
  trading_symbol: string;
  instrument_token: string;
  exchange: "NFO" | "BSE" | "NSE";
  transaction_type: OrderSide;
  order_type: OrderType;
  product: ProductType;
  quantity: number;
  price?: number;
  trigger_price?: number;
  validity: "DAY" | "IOC";
  tag?: string;
}

export interface PlaceOrderResponse {
  status: "success" | "error";
  order_id?: string;
  message: string;
}

export interface Order {
  order_id: string;
  trading_symbol: string;
  transaction_type: OrderSide;
  order_type: OrderType;
  product: ProductType;
  quantity: number;
  price: number;
  status: OrderStatus;
  filled_quantity: number;
  average_price: number;
  placed_at: string;
  exchange_order_id?: string;
}

// ─── UI STATE ─────────────────────────────────────────────────────────────────
export type ActiveTab = "oi" | "iv" | "gex" | "order" | "depth";
export type Underlying = "NIFTY" | "BANKNIFTY" | "FINNIFTY" | "MIDCPNIFTY";

export interface DashboardFilter {
  underlying: Underlying;
  expiry: string;
  strikeRange: number;  // number of strikes above/below ATM
  showGreeks: boolean;
  showDepth: boolean;
}

export interface ConnectionStatus {
  ws: "connecting" | "connected" | "disconnected" | "error";
  rest: "idle" | "loading" | "success" | "error";
  auth: "unauthenticated" | "authenticating" | "authenticated" | "expired";
}

export interface FlashState {
  [instrumentToken: string]: "up" | "down" | null;
}

// ─── CHART DATA ───────────────────────────────────────────────────────────────
export interface OIChartPoint {
  strike: number;
  callOI: number;
  putOI: number;
  callOIChange: number;
  putOIChange: number;
}

export interface IVChartPoint {
  strike: number;
  callIV: number;
  putIV: number;
}

export interface GEXChartPoint {
  strike: number;
  gex: number;
}
