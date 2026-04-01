'use client';

import { useDashboardStore } from '@/lib/store';
import { OIProfileChart, OIChangeChart } from './charts/OIProfileChart';
import { IVSmileChart } from './charts/IVSmileChart';
import { GEXChart } from './charts/GEXChart';
import { ActiveTab } from '@/types';
import clsx from 'clsx';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'oi', label: 'OI Profile' },
  { id: 'iv', label: 'IV Smile' },
  { id: 'gex', label: 'GEX' },
];

export function ChartModal() {
  const {
    isChartModalOpen,
    activeTab,
    setActiveTab,
    setIsChartModalOpen,
    lastUpdateTime,
    emaPeriod,
    showEMA,
    setEmaPeriod,
    setShowEMA,
  } = useDashboardStore();

  if (!isChartModalOpen) return null;

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-1 rounded-lg shadow-xl w-[90vw] max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">Charts</h2>
            {lastUpdateTime && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>
                <span>Live</span>
                <span>{formatLastUpdate(lastUpdateTime)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* EMA Controls */}
            {activeTab === 'oi' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEMA(!showEMA)}
                  className={clsx(
                    'px-2.5 py-1 rounded text-[11px] font-mono border transition-colors',
                    showEMA
                      ? 'border-accent-amber text-accent-amber bg-accent-amber/10'
                      : 'border-border text-text-secondary hover:text-text-primary'
                  )}
                >
                  EMA
                </button>
                {showEMA && (
                  <select
                    value={emaPeriod}
                    onChange={e => setEmaPeriod(Number(e.target.value))}
                    className="px-2 py-1 rounded text-[11px] font-mono border border-border bg-surface-2 text-text-primary"
                  >
                    <option value={5}>5</option>
                    <option value={9}>9</option>
                    <option value={12}>12</option>
                    <option value={20}>20</option>
                    <option value={26}>26</option>
                  </select>
                )}
              </div>
            )}
            <button
              onClick={() => setIsChartModalOpen(false)}
              className="p-1 rounded hover:bg-surface-2 transition-colors"
            >
              <span className="text-text-muted text-lg">×</span>
            </button>
          </div>
        </div>

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

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'oi' && (
            <div className="flex flex-col gap-6">
              <div className="h-[45%] min-h-[300px]">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  Open Interest Profile
                </h3>
                <div className="h-full">
                  <OIProfileChart />
                </div>
              </div>
              <div className="h-[45%] min-h-[300px]">
                <h3 className="text-sm font-medium text-text-secondary mb-3">
                  OI Change
                </h3>
                <div className="h-full">
                  <OIChangeChart />
                </div>
              </div>
            </div>
          )}
          {activeTab === 'iv' && (
            <div className="h-full">
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                Implied Volatility Smile
              </h3>
              <div className="h-full">
                <IVSmileChart />
              </div>
            </div>
          )}
          {activeTab === 'gex' && (
            <div className="h-full">
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                Gamma Exposure
              </h3>
              <div className="h-full">
                <GEXChart />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
