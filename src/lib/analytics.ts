/**
 * Options Analytics
 * PROC-02: Greeks calculation
 * PROC-03: OI analytics — cumulative_oi, cumulative_call_oi, cumulative_put_oi
 * PROC-04: Volume aggregation — tick_volume, cumulative_volume, VWAP
 * UI-02: GEX calculation
 * UI-05: Max Pain calculation
 */

import {
  OptionChainRow,
  OIChartPoint,
  IVChartPoint,
  GEXChartPoint,
} from '@/types';

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
  if (pcr > 1.5) return { label: 'Extremely Bullish', color: '#00d97e' };
  if (pcr > 1.2) return { label: 'Bullish', color: '#00d97e' };
  if (pcr > 0.8) return { label: 'Neutral', color: '#f59e0b' };
  if (pcr > 0.5) return { label: 'Bearish', color: '#ff4560' };
  return { label: 'Extremely Bearish', color: '#ff4560' };
}

// ─── Gamma Exposure (GEX) ─────────────────────────────────────────────────────
// GEX = Delta × Gamma × OI × Spot × Contract_multiplier
// Positive GEX: dealers are long gamma → stabilizing price
// Negative GEX: dealers are short gamma → volatile/trend-following
export function calculateGEX(
  row: OptionChainRow,
  spot: number,
  multiplier = 50
): number {
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
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── EMA Calculation ───────────────────────────────────────────────────────────
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  if (period <= 1) return [...data];

  const multiplier = 2 / (period + 1);
  const ema: number[] = [];

  // Start with SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i];
  }
  ema.push(sum / Math.min(period, data.length));

  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    const currentEMA =
      (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }

  return ema;
}

// Calculate EMA for chart data points
export function calculateEMAForChart(
  data: { strike: number; value: number }[],
  period: number
): { strike: number; value: number; ema: number }[] {
  if (data.length === 0) return [];

  const values = data.map(d => d.value);
  const emaValues = calculateEMA(values, period);

  return data.map((point, index) => ({
    ...point,
    ema: index < emaValues.length ? emaValues[index] : point.value,
  }));
}

// ─── Chart data transformers ──────────────────────────────────────────────────
export function toOIChartData(
  rows: OptionChainRow[],
  emaPeriod: number = 9
): OIChartPoint[] {
  const baseData = rows.map(r => ({
    strike: r.strike,
    callOI: Math.round(r.call.oi / 1000), // in thousands
    putOI: Math.round(r.put.oi / 1000),
    callOIChange: Math.round(r.call.oi_change / 1000),
    putOIChange: Math.round(r.put.oi_change / 1000),
  }));

  // Add EMA for call and put OI
  const callEMAData = calculateEMAForChart(
    baseData.map(d => ({ strike: d.strike, value: d.callOI })),
    emaPeriod
  );

  const putEMAData = calculateEMAForChart(
    baseData.map(d => ({ strike: d.strike, value: d.putOI })),
    emaPeriod
  );

  return baseData.map((point, index) => ({
    ...point,
    callOIEMA: callEMAData[index]?.ema || point.callOI,
    putOIEMA: putEMAData[index]?.ema || point.putOI,
  }));
}

export function toIVChartData(rows: OptionChainRow[]): IVChartPoint[] {
  return rows.map(r => ({
    strike: r.strike,
    callIV: +r.call.greeks.iv.toFixed(2),
    putIV: +r.put.greeks.iv.toFixed(2),
  }));
}

export function toGEXChartData(
  rows: OptionChainRow[],
  spot: number
): GEXChartPoint[] {
  return rows.map(r => ({
    strike: r.strike,
    gex: +(calculateGEX(r, spot) / 1e6).toFixed(2), // in millions
  }));
}

// ─── Format helpers ───────────────────────────────────────────────────────────
export function formatOI(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

export function formatPrice(n: number): string {
  //return new Intl.NumberFormat('en-IN', {
  //  minimumFractionDigits: 2,
  //  maximumFractionDigits: 2,
  //}).format(n);
    return new Intl.NumberFormat('en-IN').format(n / 100);
}

export function formatStrike(n: number): string {
  // If the number ends with two zeros, remove them
  //if (n % 100 === 0 && n !== 0) {
    return new Intl.NumberFormat('en-IN').format(n / 100);
  //}
  //return new Intl.NumberFormat('en-IN').format(n);
}

export function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatLargeNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

// ─── OI Bar width (0–100%) ───────────────────────────────────────────────────
export function oiBarWidth(oi: number, maxOI: number): number {
  if (maxOI === 0) return 0;
  return Math.min(100, (oi / maxOI) * 100);
}
