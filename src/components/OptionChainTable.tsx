'use client';

import { useMemo } from 'react';
import { useDashboardStore } from '@/lib/store';
import { OptionChainRow, OptionLeg } from '@/types';
import { formatOI, formatPrice, oiBarWidth } from '@/lib/analytics';
import clsx from 'clsx';

// ─── OI Bar ───────────────────────────────────────────────────────────────────
function OIBar({
  oi,
  maxOI,
  side,
}: {
  oi: number;
  maxOI: number;
  side: 'call' | 'put';
}) {
  const width = oiBarWidth(oi, maxOI);
  return (
    <div className="flex items-center gap-1.5">
      {side === 'call' && (
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono text-text-secondary w-12 text-right">
            {formatOI(oi)}
          </span>
          <div className="w-16 h-1 bg-surface-3 rounded overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded transition-all duration-300"
              style={{ width: `${width}%` }}
            />
          </div>
        </div>
      )}
      {side === 'put' && (
        <div className="flex items-center gap-1">
          <div className="w-16 h-1 bg-surface-3 rounded overflow-hidden">
            <div
              className="h-full bg-accent-red rounded transition-all duration-300"
              style={{ width: `${width}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-text-secondary w-12">
            {formatOI(oi)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Change Cell ──────────────────────────────────────────────────────────────
function ChangeCell({ pct }: { pct: number }) {
  const isUp = pct >= 0;
  return (
    <span
      className={clsx(
        'text-[11px] font-mono',
        isUp ? 'text-accent-green' : 'text-accent-red'
      )}
    >
      {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// ─── Price Cell with flash ────────────────────────────────────────────────────
function PriceCell({
  value,
  token,
  flashState,
  bold,
}: {
  value: number;
  token: string;
  flashState: Record<string, 'up' | 'down' | null>;
  bold?: boolean;
}) {
  const flash = flashState[token];
  return (
    <span
      className={clsx(
        'text-[11px] font-mono transition-all duration-100',
        bold ? 'text-text-primary font-medium' : 'text-text-secondary',
        flash === 'up' && 'animate-flash-green text-accent-green',
        flash === 'down' && 'animate-flash-red text-accent-red'
      )}
    >
      {formatPrice(value)}
    </span>
  );
}

// ─── Greeks cells ─────────────────────────────────────────────────────────────
function GreekCell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <td className="px-2 py-1.5 text-center">
      <span
        className="text-[10px] font-mono"
        style={{ color: color || '#7a8fa6' }}
      >
        {value.toFixed(2)}
      </span>
    </td>
  );
}

// ─── Market Depth Tooltip ─────────────────────────────────────────────────────
function DepthRow({ leg, side }: { leg: OptionLeg; side: 'call' | 'put' }) {
  const topBids = leg.depth?.bids?.slice(0, 3) ?? [];
  const topAsks = leg.depth?.asks?.slice(0, 3) ?? [];

  if (!topBids.length && !topAsks.length) return null;

  return (
    <tr className="bg-surface-2/50">
      <td
        colSpan={side === 'call' ? 8 : 0}
        className={clsx(side === 'put' && 'hidden')}
      >
        {side === 'call' && (
          <div className="px-3 py-1">
            <div className="text-[9px] font-mono text-text-muted mb-0.5">
              TOP 3 BIDS
            </div>
            {topBids.map((b, i) => (
              <div
                key={i}
                className="flex gap-2 text-[10px] font-mono text-accent-green"
              >
                <span>{b.price.toFixed(2)}</span>
                <span className="text-text-muted">×{b.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-1 text-center">
        <span className="text-[9px] font-mono text-text-muted">DEPTH</span>
      </td>
      <td
        colSpan={side === 'put' ? 8 : 0}
        className={clsx(side === 'call' && 'hidden')}
      >
        {side === 'put' && (
          <div className="px-3 py-1">
            <div className="text-[9px] font-mono text-text-muted mb-0.5">
              TOP 3 ASKS
            </div>
            {topAsks.map((a, i) => (
              <div
                key={i}
                className="flex gap-2 text-[10px] font-mono text-accent-red"
              >
                <span>{a.price.toFixed(2)}</span>
                <span className="text-text-muted">×{a.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────
export function OptionChainTable() {
  const { filteredRows, filter, flashState, snapshot, selectStrike } =
    useDashboardStore();

  const maxCallOI = useMemo(
    () => Math.max(...filteredRows.map(r => r.call.oi), 1),
    [filteredRows]
  );
  const maxPutOI = useMemo(
    () => Math.max(...filteredRows.map(r => r.put.oi), 1),
    [filteredRows]
  );

  if (!snapshot) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-muted border-t-accent-green rounded-full animate-spin mx-auto mb-3" />
          <p className="text-text-muted font-mono text-sm">
            Loading option chain…
          </p>
        </div>
      </div>
    );
  }

  if (filteredRows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <p className="text-text-muted font-mono text-sm">
          No data. Select an expiry.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto flex-1">
      <table
        className="w-full border-collapse text-[11px]"
        style={{ minWidth: 900 }}
      >
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-1 border-b border-border">
            {/* CALLS header */}
            <th
              colSpan={filter.showGreeks ? 8 : 5}
              className="py-1.5 px-2 text-center text-[9px] font-mono font-medium tracking-widest text-accent-blue uppercase border-r border-border bg-accent-blue/5"
            >
              ← CALLS
            </th>
            <th className="py-1.5 px-3 text-center text-[9px] font-mono font-medium tracking-widest text-text-muted uppercase">
              STRIKE
            </th>
            {/* PUTS header */}
            <th
              colSpan={filter.showGreeks ? 8 : 5}
              className="py-1.5 px-2 text-center text-[9px] font-mono font-medium tracking-widest text-accent-red uppercase border-l border-border bg-accent-red/5"
            >
              PUTS →
            </th>
          </tr>
          <tr className="bg-surface-2 border-b border-border text-[9px] font-mono text-text-muted uppercase tracking-widest">
            {/* Call columns */}
            <th className="py-1.5 px-2 text-right bg-accent-blue/5">OI</th>
            <th className="py-1.5 px-2 text-right bg-accent-blue/5">Chg%</th>
            {filter.showGreeks && (
              <>
                <th className="py-1.5 px-2 text-center bg-accent-blue/5">IV</th>
                <th className="py-1.5 px-2 text-center bg-accent-blue/5">Δ</th>
                <th className="py-1.5 px-2 text-center bg-accent-blue/5">Θ</th>
              </>
            )}
            <th className="py-1.5 px-2 text-right bg-accent-blue/5">Bid</th>
            <th className="py-1.5 px-2 text-right bg-accent-blue/5">LTP</th>
            <th className="py-1.5 px-2 text-right bg-accent-blue/5 border-r border-border">
              Ask
            </th>

            {/* Strike */}
            <th className="py-1.5 px-3 text-center font-medium text-text-secondary">
              —
            </th>

            {/* Put columns */}
            <th className="py-1.5 px-2 text-left bg-accent-red/5 border-l border-border">
              Bid
            </th>
            <th className="py-1.5 px-2 text-left bg-accent-red/5">LTP</th>
            <th className="py-1.5 px-2 text-left bg-accent-red/5">Ask</th>
            {filter.showGreeks && (
              <>
                <th className="py-1.5 px-2 text-center bg-accent-red/5">IV</th>
                <th className="py-1.5 px-2 text-center bg-accent-red/5">Δ</th>
                <th className="py-1.5 px-2 text-center bg-accent-red/5">Θ</th>
              </>
            )}
            <th className="py-1.5 px-2 text-left bg-accent-red/5">Chg%</th>
            <th className="py-1.5 px-2 text-left bg-accent-red/5">OI</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map(row => (
            <ChainRow
              key={row.strike}
              row={row}
              maxCallOI={maxCallOI}
              maxPutOI={maxPutOI}
              flashState={flashState}
              showGreeks={filter.showGreeks}
              showDepth={filter.showDepth}
              onSelectCall={() => selectStrike(row.strike, 'call')}
              onSelectPut={() => selectStrike(row.strike, 'put')}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Individual row ───────────────────────────────────────────────────────────
function ChainRow({
  row,
  maxCallOI,
  maxPutOI,
  flashState,
  showGreeks,
  showDepth,
  onSelectCall,
  onSelectPut,
}: {
  row: OptionChainRow;
  maxCallOI: number;
  maxPutOI: number;
  flashState: Record<string, 'up' | 'down' | null>;
  showGreeks: boolean;
  showDepth: boolean;
  onSelectCall: () => void;
  onSelectPut: () => void;
}) {
  const c = row.call;
  const p = row.put;

  return (
    <>
      <tr
        className={clsx(
          'border-b border-border transition-colors group',
          row.isATM
            ? 'bg-accent-green/5 border-accent-green/30'
            : 'hover:bg-surface-2/60'
        )}
      >
        {/* Call OI */}
        <td className="px-2 py-1.5 text-right bg-accent-blue/[0.02]">
          <OIBar oi={c.oi} maxOI={maxCallOI} side="call" />
        </td>

        {/* Call OI Chg */}
        <td className="px-2 py-1.5 text-right bg-accent-blue/[0.02]">
          <ChangeCell pct={c.oi_change_pct} />
        </td>

        {/* Call Greeks */}
        {showGreeks && (
          <>
            <GreekCell label="IV" value={c.greeks.iv} color="#7a8fa6" />
            <GreekCell label="Δ" value={c.greeks.delta} color="#2d9cf0" />
            <GreekCell label="Θ" value={c.greeks.theta} color="#ff4560" />
          </>
        )}

        {/* Call Bid */}
        <td className="px-2 py-1.5 text-right bg-accent-blue/[0.02]">
          <PriceCell
            value={c.bid}
            token={c.instrument_token + '_bid'}
            flashState={flashState}
          />
        </td>

        {/* Call LTP — clickable */}
        <td
          className="px-2 py-1.5 text-right bg-accent-blue/[0.02] cursor-pointer"
          onClick={onSelectCall}
        >
          <PriceCell
            value={c.ltp}
            token={c.instrument_token}
            flashState={flashState}
            bold
          />
        </td>

        {/* Call Ask */}
        <td className="px-2 py-1.5 text-right bg-accent-blue/[0.02] border-r border-border">
          <PriceCell
            value={c.ask}
            token={c.instrument_token + '_ask'}
            flashState={flashState}
          />
        </td>

        {/* ── STRIKE ── */}
        <td className="px-3 py-1.5 text-center">
          <span
            className={clsx(
              'font-mono font-medium text-[12px] px-2 py-0.5 rounded',
              row.isATM
                ? 'bg-accent-green text-surface-DEFAULT'
                : 'text-text-secondary'
            )}
          >
            {row.strike.toLocaleString('en-IN')}
          </span>
        </td>

        {/* Put Bid */}
        <td className="px-2 py-1.5 text-left bg-accent-red/[0.02] border-l border-border">
          <PriceCell
            value={p.bid}
            token={p.instrument_token + '_bid'}
            flashState={flashState}
          />
        </td>

        {/* Put LTP — clickable */}
        <td
          className="px-2 py-1.5 text-left bg-accent-red/[0.02] cursor-pointer"
          onClick={onSelectPut}
        >
          <PriceCell
            value={p.ltp}
            token={p.instrument_token}
            flashState={flashState}
            bold
          />
        </td>

        {/* Put Ask */}
        <td className="px-2 py-1.5 text-left bg-accent-red/[0.02]">
          <PriceCell
            value={p.ask}
            token={p.instrument_token + '_ask'}
            flashState={flashState}
          />
        </td>

        {/* Put Greeks */}
        {showGreeks && (
          <>
            <GreekCell label="IV" value={p.greeks.iv} color="#7a8fa6" />
            <GreekCell label="Δ" value={p.greeks.delta} color="#2d9cf0" />
            <GreekCell label="Θ" value={p.greeks.theta} color="#ff4560" />
          </>
        )}

        {/* Put OI Chg */}
        <td className="px-2 py-1.5 text-left bg-accent-red/[0.02]">
          <ChangeCell pct={p.oi_change_pct} />
        </td>

        {/* Put OI */}
        <td className="px-2 py-1.5 text-left bg-accent-red/[0.02]">
          <OIBar oi={p.oi} maxOI={maxPutOI} side="put" />
        </td>
      </tr>
      {showDepth && <DepthRow leg={c} side="call" />}
    </>
  );
}
