'use client';

import { HistoricalDataPoint, HistoricalData } from '@/types';

interface HistoricalDataDisplayProps {
  data: HistoricalData;
}

// ─── Tooltip Component ───────────────────────────────────────────────────────────
function Tooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) {
  const groupId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div className={groupId}>
      <div className="relative inline-block group/item">
        {children}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-surface-1 border border-border rounded text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-0.5 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-1"></div>
        </div>
      </div>
    </div>
  );
}

const fieldShortcuts: { [key: string]: string } = {
  open: 'Open',
  high: 'High',
  low: 'Low',
  close: 'Close',
  tick_volume: 'TV',
  cumulative_volume: 'CV',
  cumulative_volume_premium: 'CVP',
  cumulative_oi: 'COI',
  cumulative_call_oi: 'CCI',
  cumulative_put_oi: 'CPI',
  cumulative_fut_oi: 'CFI',
  l1bid: 'BID',
  l1ask: 'ASK',
  theta: 'θ',
  delta: 'Δ',
  gamma: 'Γ',
  vega: 'ν',
  iv_bid: 'IVB',
  iv_ask: 'IVA',
  iv_mid: 'IV',
  cumulative_volume_delta: 'CVD',
  value: 'VAL',
};

const fieldTooltips: { [key: string]: string } = {
  open: 'Open Price',
  high: 'High Price',
  low: 'Low Price',
  close: 'Close Price',
  tick_volume: 'Tick Volume',
  cumulative_volume: 'Cumulative Volume',
  cumulative_volume_premium: 'Cumulative Volume Premium',
  cumulative_oi: 'Cumulative Open Interest',
  cumulative_call_oi: 'Cumulative Call Open Interest',
  cumulative_put_oi: 'Cumulative Put Open Interest',
  cumulative_fut_oi: 'Cumulative Futures Open Interest',
  l1bid: 'Level 1 Bid',
  l1ask: 'Level 1 Ask',
  theta: 'Theta (Time Decay)',
  delta: 'Delta (Price Sensitivity)',
  gamma: 'Gamma (Rate of Delta Change)',
  vega: 'Vega (Volatility Sensitivity)',
  iv_bid: 'Implied Volatility Bid',
  iv_ask: 'Implied Volatility Ask',
  iv_mid: 'Implied Volatility Mid',
  cumulative_volume_delta: 'Cumulative Volume Delta',
  value: 'Value',
};

export function HistoricalDataDisplay({ data }: HistoricalDataDisplayProps) {
  const formatTimestamp = (nanoseconds: number) => {
    return new Date(nanoseconds / 1_000_000).toLocaleString();
  };

  if (!data || !data.result || !data.result.length) {
    return (
      <div className="bg-surface-2 rounded-lg border border-border p-6 text-center">
        <p className="text-text-muted">No data available</p>
      </div>
    );
  }

  const result = data.result[0];
  if (!result || !result.values || !result.values.length) {
    return (
      <div className="bg-surface-2 rounded-lg border border-border p-6 text-center">
        <p className="text-text-muted">No result data available</p>
      </div>
    );
  }

  const symbol = Object.keys(result.values[0])[0];
  const symbolData = result.values[0][symbol];

  if (!symbolData) {
    return (
      <div className="bg-surface-2 rounded-lg border border-border p-6 text-center">
        <p className="text-text-muted">No symbol data available for {symbol}</p>
      </div>
    );
  }

  // Process all symbols
  const allSymbolsData: Array<{
    symbol: string;
    symbolData: { [field: string]: HistoricalDataPoint[] };
    unifiedData: Array<{
      timestamp: number;
      [key: string]: number;
    }>;
  }> = [];

  result.values.forEach(valueObj => {
    Object.entries(valueObj).forEach(([symbol, symbolData]) => {
      if (!symbolData) return;

      // Get all fields for this symbol
      const allFields = Object.keys(symbolData);

      // Collect all unique timestamps across all fields for this symbol
      const allTimestamps = new Set<number>();
      allFields.forEach(field => {
        symbolData[field].forEach(point => {
          allTimestamps.add(point.ts);
        });
      });

      // Sort timestamps and create unified rows for this symbol
      const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
      const unifiedData: Array<{
        timestamp: number;
        [key: string]: number;
      }> = [];

      sortedTimestamps.forEach(ts => {
        const row: { timestamp: number; [key: string]: number } = {
          timestamp: ts,
        };
        allFields.forEach(field => {
          const point = symbolData[field].find(p => p.ts === ts);
          row[field] = point ? point.v : 0;
        });
        unifiedData.push(row);
      });

      allSymbolsData.push({
        symbol,
        symbolData,
        unifiedData,
      });
    });
  });

  return (
    <div className="space-y-8">
      {/* Data Summary Header */}
      <div className="bg-surface-2 rounded-lg border border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-accent-green animate-pulse-dot" />
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  Symbols
                </div>
                <div className="text-lg font-mono font-semibold text-foreground">
                  {allSymbolsData.map(s => s.symbol).join(', ')}
                </div>
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-text-muted">
                Exchange
              </div>
              <div className="text-sm font-mono font-medium text-foreground">
                {result.exchange}
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-text-muted">
                Type
              </div>
              <div className="text-sm font-mono font-medium text-foreground">
                {result.type}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Total Data Points
            </div>
            <div className="text-sm font-mono font-medium text-foreground">
              {allSymbolsData
                .reduce((sum, s) => sum + s.unifiedData.length, 0)
                .toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Tables for each symbol */}
      {allSymbolsData.map((symbolInfo, symbolIndex) => (
        <div
          key={symbolInfo.symbol}
          className="bg-surface-2 rounded-lg border border-border overflow-hidden"
        >
          <div className="overflow-x-auto">
            <div className="max-h-96 overflow-y-auto">
              {/* Symbol Header */}
              <div className="px-6 py-4 h-14 border-b border-border bg-gradient-to-r from-surface-3 to-surface-2 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent-green" />
                    <h3 className="text-base font-semibold text-foreground font-mono">
                      {symbolInfo.symbol}
                    </h3>
                    <span className="px-2 py-1 bg-accent-muted/20 text-accent-green text-xs font-mono rounded">
                      {Object.keys(symbolInfo.symbolData).length} fields •{' '}
                      {symbolInfo.unifiedData.length} points
                    </span>
                  </div>
                  <div className="text-xs font-mono text-text-muted">
                    Latest:{' '}
                    {symbolInfo.unifiedData.length > 0
                      ? formatTimestamp(
                          symbolInfo.unifiedData[
                            symbolInfo.unifiedData.length - 1
                          ].timestamp
                        )
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Table Container */}

              <table className="w-full">
                <thead className="bg-surface-3 sticky top-14 z-10 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-mono uppercase tracking-wider min-w-32">
                      Timestamp
                    </th>
                    {Object.keys(symbolInfo.symbolData).map(field => (
                      <th key={field}>
                        <Tooltip content={fieldTooltips[field]}>
                          <div className="px-2 py-2 text-center text-xs font-mono uppercase">
                            {fieldShortcuts[field]}
                          </div>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {symbolInfo.unifiedData.slice(0, 100).map((row, index) => (
                    <tr
                      key={index}
                      className="hover:bg-surface-1/50 transition-colors duration-150"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {formatTimestamp(row.timestamp)}
                      </td>
                      {Object.keys(symbolInfo.symbolData).map(field => (
                        <td
                          key={field}
                          className="px-2 py-2 font-mono text-xs text-foreground text-center"
                        >
                          {row[field] !== 0 ? row[field].toLocaleString() : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer with more info */}
              {symbolInfo.unifiedData.length > 100 && (
                <div className="px-6 py-4 bg-surface-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-text-muted font-mono">
                      Showing first 100 of{' '}
                      {symbolInfo.unifiedData.length.toLocaleString()} data
                      points
                    </p>
                    <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
                      <span>
                        Range:{' '}
                        {formatTimestamp(symbolInfo.unifiedData[0].timestamp)} -{' '}
                        {formatTimestamp(
                          symbolInfo.unifiedData[
                            symbolInfo.unifiedData.length - 1
                          ].timestamp
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
