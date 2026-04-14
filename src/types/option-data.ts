export interface OptionData {
  instId: string;
  ts: string;
  sp: string;
  ls: number;
  ltp: string;
  ltpchg: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  oi: string;
  volume: string;
  refId: string;
  prevOi: string;
  pricePcp: string;
}

export interface OptionGreeks {
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionTick {
  instrument_token: string;
  strike_price: number;
  last_price: number;
  price_change: number;
  volume: number;
  open_interest: number;
  previous_oi: number;
  greeks: OptionGreeks;
  timestamp: number;
  lot_size: number;
  reference_id: string;
  price_percent_change: number;
}
