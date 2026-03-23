/**
 * Options Analytics
 * PROC-02: Greeks calculation
 * PROC-03: OI analytics — cumulative_oi, cumulative_call_oi, cumulative_put_oi
 * PROC-04: Volume aggregation — tick_volume, cumulative_volume, VWAP
 * UI-02: GEX calculation
 * UI-05: Max Pain calculation
 */

import { OptionChainRow, OIChartPoint, IVChartPoint, GEXChartPoint } from "@/types";

// ─── Max Pain ─────────────────────────────────────────────────────────────────
// Max Pain = strike where total options dollar loss is maximized
export function calculateMaxPain(rows: OptionChainRow[]): number {
  let minLoss = Infinity;
  let maxPainStrike = rows[0]?.strike ?? 0;

  for (const targetRow of rows) {
    const targetStrike = targetRow.strike;
    let totalLoss = 0;

    for (const row of rows) {
      // Call writers lose when spot > strike
      if (targetStrike > row.strike) {
        totalLoss += (targetStrike - row.strike) * row.call.oi;
      }
      // Put writers lose when spot < strike
      if (targetStrike < row.strike) {
        totalLoss += (row.strike - targetStrike) * row.put.oi;
      }
    }

    if (totalLoss < minLoss) {
      minLoss = totalLoss;
      maxPainStrike = targetStrike;
    }
  }

  return maxPainStrike;
}

// ─── Put-Call Ratio ────────────────────────────────────────────────────────────
export function calculatePCR(rows: OptionChainRow[]): number {
  const totalCallOI = rows.reduce((acc, r) => acc + r.call.oi, 0);
  const totalPutOI = rows.reduce((acc, r) => acc + r.put.oi, 0);
  return totalCallOI > 0 ? +(totalPutOI / totalCallOI).toFixed(2) : 0;
}

export function getPCRSignal(pcr: number): { label: string; color: string } {
  if (pcr > 1.5) return { label: "Extremely Bullish", color: "#00d97e" };
  if (pcr > 1.2) return { label: "Bullish", color: "#00d97e" };
  if (pcr > 0.8) return { label: "Neutral", color: "#f59e0b" };
  if (pcr > 0.5) return { label: "Bearish", color: "#ff4560" };
  return { label: "Extremely Bearish", color: "#ff4560" };
}

// ─── Gamma Exposure (GEX) ─────────────────────────────────────────────────────
// GEX = Delta × Gamma × OI × Spot × Contract_multiplier
// Positive GEX: dealers are long gamma → stabilizing price
// Negative GEX: dealers are short gamma → volatile/trend-following
export function calculateGEX(row: OptionChainRow, spot: number, multiplier = 50): number {
  const callGEX = row.call.greeks.gamma * row.call.oi * spot * multiplier;
  const putGEX = -row.put.greeks.gamma * row.put.oi * spot * multiplier;
  return +(callGEX + putGEX).toFixed(2);
}

export function calculateNetGEX(rows: OptionChainRow[], spot: number): number {
  return rows.reduce((acc, row) => acc + calculateGEX(row, spot), 0);
}

// ─── VWAP Calculation ─────────────────────────────────────────────────────────
// PROC-04: cumulative_volume_premium based VWAP
export function calculateVWAP(
  premiumVolume: number,
  cumulativeVolume: number
): number {
  if (cumulativeVolume === 0) return 0;
  return +(premiumVolume / cumulativeVolume).toFixed(2);
}

// ─── OI Change % ──────────────────────────────────────────────────────────────
export function oiChangeLabel(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Chart data transformers ──────────────────────────────────────────────────
export function toOIChartData(rows: OptionChainRow[]): OIChartPoint[] {
  return rows.map((r) => ({
    strike: r.strike,
    callOI: Math.round(r.call.oi / 1000),      // in thousands
    putOI: Math.round(r.put.oi / 1000),
    callOIChange: Math.round(r.call.oi_change / 1000),
    putOIChange: Math.round(r.put.oi_change / 1000),
  }));
}

export function toIVChartData(rows: OptionChainRow[]): IVChartPoint[] {
  return rows.map((r) => ({
    strike: r.strike,
    callIV: +r.call.greeks.iv.toFixed(2),
    putIV: +r.put.greeks.iv.toFixed(2),
  }));
}

export function toGEXChartData(rows: OptionChainRow[], spot: number): GEXChartPoint[] {
  return rows.map((r) => ({
    strike: r.strike,
    gex: +(calculateGEX(r, spot) / 1e6).toFixed(2), // in millions
  }));
}

// ─── Format helpers ───────────────────────────────────────────────────────────
export function formatOI(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatStrike(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatLargeNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

// ─── OI Bar width (0–100%) ───────────────────────────────────────────────────
export function oiBarWidth(oi: number, maxOI: number): number {
  if (maxOI === 0) return 0;
  return Math.min(100, (oi / maxOI) * 100);
}
