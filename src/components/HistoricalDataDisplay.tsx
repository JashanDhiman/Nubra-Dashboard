'use client';

import { HistoricalDataPoint, HistoricalData } from '@/types';

interface HistoricalDataDisplayProps {
  data: HistoricalData;
}

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
                  Symbol
                </div>
                <div className="text-lg font-mono font-semibold text-foreground">
                  {symbol}
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
              Fields
            </div>
            <div className="text-sm font-mono font-medium text-foreground">
              {Object.keys(symbolData).length}
            </div>
          </div>
        </div>
      </div>

      {/* Data Tables - Full Width */}
      <div className="space-y-6">
        {Object.entries(symbolData).map(
          ([field, points]: [string, HistoricalDataPoint[]]) => (
            <div
              key={field}
              className="bg-surface-2 rounded-lg border border-border overflow-hidden"
            >
              {/* Field Header */}
              <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-surface-3 to-surface-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent-green" />
                    <h3 className="text-base font-semibold text-foreground font-mono capitalize">
                      {field}
                    </h3>
                    <span className="px-2 py-1 bg-accent-muted/20 text-accent-green text-xs font-mono rounded">
                      {points.length} points
                    </span>
                  </div>
                  <div className="text-xs font-mono text-text-muted">
                    Latest:{' '}
                    {points.length > 0
                      ? formatTimestamp(points[points.length - 1].ts)
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-surface-3 sticky top-0 z-10 border-b border-border">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-mono uppercase tracking-wider text-text-muted w-1/3">
                          Timestamp
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-mono uppercase tracking-wider text-text-muted w-1/3">
                          Value
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-mono uppercase tracking-wider text-text-muted w-1/3">
                          Index
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {points
                        .slice(0, 20)
                        .map((point: HistoricalDataPoint, index: number) => (
                          <tr
                            key={index}
                            className="hover:bg-surface-1/50 transition-colors duration-150"
                          >
                            <td className="px-6 py-3 font-mono text-sm text-muted-foreground">
                              {formatTimestamp(point.ts)}
                            </td>
                            <td className="px-6 py-3 font-mono text-base text-foreground text-right font-medium">
                              {point.v.toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-mono text-xs text-text-muted text-center">
                              #{index + 1}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* Footer with more info */}
                  {points.length > 20 && (
                    <div className="px-6 py-4 bg-surface-3 border-t border-border">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-text-muted font-mono">
                          Showing first 20 of {points.length.toLocaleString()}{' '}
                          data points
                        </p>
                        <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
                          <span>
                            Range: {formatTimestamp(points[0].ts)} -{' '}
                            {formatTimestamp(points[points.length - 1].ts)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
