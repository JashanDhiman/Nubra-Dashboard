/**
 * Mock data generator — used automatically when NUBRA_API_KEY is not set.
 * Produces realistic option chain data with proper Greeks, OI, and depth.
 * Replace with live Nubra API calls by setting credentials in .env.local
 */

import {
  OptionChainSnapshot,
  OptionChainRow,
  OptionLeg,
  Greeks,
  MarketDepth,
} from '@/types';

// ─── Config per underlying ────────────────────────────────────────────────────
const CONFIGS: Record<
  string,
  { spot: number; step: number; atm: number; lotSize: number; ivBase: number }
> = {
  NIFTY: { spot: 24042, step: 50, atm: 24050, lotSize: 50, ivBase: 14 },
  BANKNIFTY: { spot: 51340, step: 100, atm: 51300, lotSize: 15, ivBase: 16 },
  FINNIFTY: { spot: 23580, step: 50, atm: 23600, lotSize: 40, ivBase: 15 },
  MIDCPNIFTY: { spot: 12800, step: 25, atm: 12800, lotSize: 75, ivBase: 18 },
};

// Deterministic seeded random — same seed → same value, so data is stable between calls
function seededRand(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

function buildGreeks(
  strike: number,
  spot: number,
  isCall: boolean,
  ivBase: number,
  seed: number
): Greeks {
  const moneyness = (spot - strike) / spot;
  const dist = Math.abs(moneyness);

  // IV smile — higher at wings
  const iv = +(ivBase + dist * 120 + seededRand(seed, -0.5, 1.5)).toFixed(2);

  // Approximate Black-Scholes delta
  const rawDelta = isCall
    ? Math.max(
        0.01,
        Math.min(0.99, 0.5 + moneyness * 3 + seededRand(seed + 1, -0.02, 0.02))
      )
    : Math.max(
        -0.99,
        Math.min(
          -0.01,
          -0.5 + moneyness * 3 + seededRand(seed + 1, -0.02, 0.02)
        )
      );

  const delta = +rawDelta.toFixed(3);
  const gamma = +(
    0.0002 * Math.exp(-dist * 15) +
    seededRand(seed + 2, 0, 0.00005)
  ).toFixed(5);
  const theta = +(
    -(iv / 100) * spot * gamma * 0.5 +
    seededRand(seed + 3, -0.5, 0)
  ).toFixed(2);
  const vega = +(spot * gamma * 0.01 + seededRand(seed + 4, 0, 0.05)).toFixed(
    3
  );

  return { iv, delta, gamma, theta, vega };
}

function buildDepth(midPrice: number, seed: number): MarketDepth {
  const bids = Array.from({ length: 5 }, (_, i) => ({
    price: +(
      midPrice * (1 - (i + 1) * 0.002) +
      seededRand(seed + i, -0.1, 0.1)
    ).toFixed(2),
    quantity: Math.round(seededRand(seed + i + 10, 50, 500)),
    orders: Math.round(seededRand(seed + i + 20, 1, 12)),
  }));
  const asks = Array.from({ length: 5 }, (_, i) => ({
    price: +(
      midPrice * (1 + (i + 1) * 0.002) +
      seededRand(seed + i + 30, -0.1, 0.1)
    ).toFixed(2),
    quantity: Math.round(seededRand(seed + i + 40, 50, 500)),
    orders: Math.round(seededRand(seed + i + 50, 1, 12)),
  }));
  return { bids, asks };
}

function buildLeg(
  strike: number,
  spot: number,
  isCall: boolean,
  underlying: string,
  expiry: string,
  ivBase: number,
  seed: number
): OptionLeg {
  const moneyness = (spot - strike) / spot;
  const dist = Math.abs(moneyness);
  const itmCall = isCall ? moneyness > 0 : moneyness < 0;

  // LTP — intrinsic + time value, decaying with distance from ATM
  const intrinsic = isCall
    ? Math.max(0, spot - strike)
    : Math.max(0, strike - spot);
  const timeValue = Math.max(
    0.5,
    seededRand(seed, 1, 60) * Math.exp(-dist * 10)
  );
  const ltp = +(intrinsic + timeValue).toFixed(2);
  const bid = +(ltp * (1 - seededRand(seed + 1, 0.005, 0.015))).toFixed(2);
  const ask = +(ltp * (1 + seededRand(seed + 2, 0.005, 0.015))).toFixed(2);

  // OI — higher near ATM, call OI > put OI slightly OTM from call side
  const oiBase = isCall
    ? moneyness > 0
      ? seededRand(seed + 3, 0.5, 1.2)
      : seededRand(seed + 3, 1.0, 3.5)
    : moneyness < 0
      ? seededRand(seed + 3, 0.5, 1.2)
      : seededRand(seed + 3, 1.0, 3.5);
  const oi = Math.round(oiBase * 1e5 * (1 + Math.exp(-dist * 8)));
  const oiChange = Math.round(seededRand(seed + 4, -5000, 15000));

  const side = isCall ? 'CE' : 'PE';
  const expiryShort = expiry.replace(/-/g, '').slice(2); // "20250327" → "250327"
  const tradingSymbol = `${underlying}${expiryShort}${strike}${side}`;
  const instrumentToken = `NFO:${tradingSymbol}`;

  const greeks = buildGreeks(strike, spot, isCall, ivBase, seed + 5);
  const depth = buildDepth(ltp, seed + 100);

  const volume = Math.round(seededRand(seed + 6, 1000, 80000));
  const cumVol = volume * Math.round(seededRand(seed + 7, 2, 8));

  return {
    instrument_token: instrumentToken,
    trading_symbol: tradingSymbol,
    ltp,
    bid,
    ask,
    open: +(ltp * seededRand(seed + 8, 0.9, 1.1)).toFixed(2),
    high: +(ltp * seededRand(seed + 9, 1.0, 1.2)).toFixed(2),
    low: +(ltp * seededRand(seed + 10, 0.7, 1.0)).toFixed(2),
    close: +(ltp * seededRand(seed + 11, 0.95, 1.05)).toFixed(2),
    change: +seededRand(seed + 12, -30, 50).toFixed(2),
    change_pct: +seededRand(seed + 13, -8, 12).toFixed(2),
    volume,
    oi,
    oi_change: oiChange,
    oi_change_pct: +((oiChange / oi) * 100).toFixed(2),
    tick_volume: Math.round(seededRand(seed + 14, 10, 300)),
    cumulative_volume: cumVol,
    cumulative_volume_premium: +(cumVol * ltp).toFixed(0),
    greeks,
    depth,
    exchange_timestamp: Date.now() * 1_000_000, // nanoseconds
  };
}

// ─── Generate expiries (weekly + monthly) ────────────────────────────────────
export function generateMockExpiries(): string[] {
  const expiries: string[] = [];
  const now = new Date();

  // Next 4 weekly Thursdays
  const d = new Date(now);
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); // next Thursday
  for (let i = 0; i < 4; i++) {
    expiries.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }

  // Next 3 monthly last-Thursday expiries
  for (let m = 1; m <= 3; m++) {
    const month = new Date(now.getFullYear(), now.getMonth() + m + 1, 0);
    month.setDate(month.getDate() - ((month.getDay() + 3) % 7)); // last Thursday
    const str = month.toISOString().slice(0, 10);
    if (!expiries.includes(str)) expiries.push(str);
  }

  return expiries;
}

// ─── Generate full option chain snapshot ─────────────────────────────────────
export function generateMockSnapshot(
  underlying: string,
  expiry: string,
  strikeCount = 20
): OptionChainSnapshot {
  const cfg = CONFIGS[underlying] ?? CONFIGS['NIFTY'];

  // Add small random drift to spot so it changes each call
  const driftSeed = Date.now() % 10000;
  const spot = cfg.spot + Math.round(seededRand(driftSeed, -50, 80));
  const atmStrike = Math.round(spot / cfg.step) * cfg.step;

  const rows: OptionChainRow[] = [];
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (let i = -strikeCount; i <= strikeCount; i++) {
    const strike = atmStrike + i * cfg.step;
    const seedBase = strike * 1000 + (expiry.charCodeAt(0) ?? 0);

    const call = buildLeg(
      strike,
      spot,
      true,
      underlying,
      expiry,
      cfg.ivBase,
      seedBase
    );
    const put = buildLeg(
      strike,
      spot,
      false,
      underlying,
      expiry,
      cfg.ivBase,
      seedBase + 500
    );

    totalCallOI += call.oi;
    totalPutOI += put.oi;

    rows.push({
      strike,
      call,
      put,
      isATM: strike === atmStrike,
      pcr: call.oi > 0 ? +(put.oi / call.oi).toFixed(2) : 0,
      netOI: call.oi - put.oi,
      gex: 0, // computed by route handler
      maxPainWeight: 0,
    });
  }

  const pcr = totalCallOI > 0 ? +(totalPutOI / totalCallOI).toFixed(2) : 0;

  return {
    underlying,
    expiry,
    spot,
    spot_change: +seededRand(driftSeed + 1, -120, 180).toFixed(2),
    spot_change_pct: +seededRand(driftSeed + 2, -0.8, 0.9).toFixed(2),
    atm_strike: atmStrike,
    total_call_oi: totalCallOI,
    total_put_oi: totalPutOI,
    pcr,
    max_pain: atmStrike - cfg.step * 2, // placeholder — overridden by route
    iv_rank: +seededRand(driftSeed + 3, 20, 85).toFixed(1),
    iv_percentile: +seededRand(driftSeed + 4, 25, 90).toFixed(1),
    rows,
    timestamp: new Date().toISOString(),
  };
}

// ─── Check if mock mode is active ────────────────────────────────────────────
export function isMockMode(): boolean {
  return false;
  return (
    !process.env.NUBRA_API_KEY ||
    process.env.NUBRA_API_KEY === 'your_client_id_here'
  );
}
