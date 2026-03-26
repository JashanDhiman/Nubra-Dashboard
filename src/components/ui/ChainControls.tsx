'use client';

import { useDashboardStore } from '@/lib/store';
import clsx from 'clsx';

const STRIKE_RANGES = [
  { label: '±5', value: 5 },
  { label: '±10', value: 10 },
  { label: '±15', value: 15 },
  { label: '±20', value: 20 },
  { label: 'All', value: 50 },
];

export function ChainControls() {
  const { filter, setFilter, filteredRows, snapshot } = useDashboardStore();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-2 border-b border-border flex-wrap">
      {/* Strike range */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
          Strikes
        </span>
        <div className="flex rounded overflow-hidden border border-border">
          {STRIKE_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setFilter({ strikeRange: r.value })}
              className={clsx(
                'px-2.5 py-1 text-[11px] font-mono border-r border-border last:border-r-0 transition-colors',
                filter.strikeRange === r.value
                  ? 'bg-accent-muted text-text-primary'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Greeks toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
          Greeks
        </span>
        <button
          onClick={() => setFilter({ showGreeks: !filter.showGreeks })}
          className={clsx(
            'px-2.5 py-1 rounded text-[11px] font-mono border transition-colors',
            filter.showGreeks
              ? 'border-accent-green text-accent-green bg-accent-green/10'
              : 'border-border text-text-secondary hover:text-text-primary'
          )}
        >
          {filter.showGreeks ? 'Hide Greeks' : 'Show Greeks'}
        </button>
      </div>

      {/* Market Depth toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
          Depth
        </span>
        <button
          onClick={() => setFilter({ showDepth: !filter.showDepth })}
          className={clsx(
            'px-2.5 py-1 rounded text-[11px] font-mono border transition-colors',
            filter.showDepth
              ? 'border-accent-blue text-accent-blue bg-accent-blue/10'
              : 'border-border text-text-secondary hover:text-text-primary'
          )}
        >
          {filter.showDepth ? 'Hide Depth' : 'Show Depth'}
        </button>
      </div>

      {/* Row count */}
      <div className="ml-auto text-[10px] font-mono text-text-muted">
        {filteredRows.length} strikes
        {snapshot && ` · ATM ${snapshot.atm_strike.toLocaleString('en-IN')}`}
      </div>
    </div>
  );
}
