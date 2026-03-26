'use client';

import { useDashboardStore } from '@/lib/store';
import { ActiveTab } from '@/types';
import { OIProfileChart, OIChangeChart } from './charts/OIProfileChart';
import { IVSmileChart } from './charts/IVSmileChart';
import { GEXChart } from './charts/GEXChart';
import { OrderPanel } from './OrderPanel';
import { formatStrike } from '@/lib/analytics';
import clsx from 'clsx';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'oi', label: 'OI Profile' },
  { id: 'iv', label: 'IV Smile' },
  { id: 'gex', label: 'GEX' },
  { id: 'order', label: 'Order' },
];

export function SidePanel() {
  const { activeTab, setActiveTab, maxPain, snapshot } = useDashboardStore();

  return (
    <div className="flex flex-col border-l border-border bg-surface-1 min-w-[300px] max-w-[340px] w-[320px]">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 py-2 text-[10px] font-mono font-medium uppercase tracking-wider transition-colors border-b-2',
              activeTab === tab.id
                ? 'text-accent-green border-accent-green'
                : 'text-text-muted border-transparent hover:text-text-secondary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'oi' && (
          <div className="p-4 flex flex-col gap-4">
            <OIProfileChart />
            <div className="border-t border-border pt-4">
              <OIChangeChart />
            </div>
          </div>
        )}
        {activeTab === 'iv' && (
          <div className="p-4">
            <IVSmileChart />
          </div>
        )}
        {activeTab === 'gex' && (
          <div className="p-4">
            <GEXChart />
          </div>
        )}
        {activeTab === 'order' && <OrderPanel />}
      </div>

      {/* Max Pain footer */}
      {maxPain > 0 && (
        <div className="border-t border-border px-4 py-2 flex items-center justify-between bg-surface-2">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            Max Pain
          </span>
          <span className="text-[12px] font-mono font-medium text-accent-amber">
            {formatStrike(maxPain)}
          </span>
          {snapshot && (
            <span className="text-[10px] font-mono text-text-muted">
              {Math.abs(snapshot.spot - maxPain).toFixed(0)} pts
            </span>
          )}
        </div>
      )}
    </div>
  );
}
