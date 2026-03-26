'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { HistoricalDataDisplay } from '@/components/HistoricalDataDisplay';
import { MultiSelect } from '@/components/MultiSelect';
import { useAuth } from '@/contexts/AuthContext';

const FIELD_OPTIONS = [
  'open',
  'high',
  'low',
  'close',
  'tick_volume',
  'cumulative_volume',
  'cumulative_volume_premium',
  'cumulative_oi',
  'cumulative_call_oi',
  'cumulative_put_oi',
  'cumulative_fut_oi',
  'l1bid',
  'l1ask',
  'theta',
  'delta',
  'gamma',
  'vega',
  'iv_bid',
  'iv_ask',
  'iv_mid',
  'cumulative_volume_delta',
];

interface HistoricalQuery {
  exchange: string;
  type: string;
  values: string[];
  fields: string[];
  startDate: string;
  endDate: string;
  interval: string;
}

interface HistoricalData {
  result: Array<{
    exchange: string;
    type: string;
    values: Array<{
      [symbol: string]: {
        [field: string]: Array<{ ts: number; v: number }>;
      };
    }>;
  }>;
}

export default function HistoricalDataPage() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
  } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState<HistoricalQuery>({
    exchange: 'NSE',
    type: 'STOCK',
    values: ['ASIANPAINT'],
    fields: ['value'],
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    endDate: new Date().toISOString(),
    interval: '1m',
  });

  const [data, setData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <div className="text-center max-w-md p-6 bg-surface-1 rounded-lg shadow border border-border">
          <p className="text-destructive mb-4">
            Authentication failed: {authError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry Authentication
          </button>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Check authentication state
    if (authLoading) {
      setError('Authentication in progress...');
      return;
    }

    if (authError) {
      setError(`Authentication error: ${authError}`);
      return;
    }

    if (!isAuthenticated) {
      setError('Please login first');
      return;
    }

    try {
      const sessionToken = localStorage.getItem('sessionToken');

      const response = await fetch('/api/nubra/historical-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ query: [query] }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (nanoseconds: number) => {
    return new Date(nanoseconds / 1_000_000).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-surface overflow-hidden">
      <Header />

      <div className="h-[calc(100vh-64px)] overflow-y-auto">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {/* Query Form Section */}
          <div className="bg-surface-1 rounded-lg border border-border p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse-dot" />
              <h2 className="text-sm font-semibold text-foreground font-mono uppercase tracking-wider">
                Query Parameters
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2">
              {/* Basic Settings Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Exchange
                  </label>
                  <select
                    value={query.exchange}
                    onChange={e =>
                      setQuery({ ...query, exchange: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-2 text-foreground font-mono text-sm"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Instrument Type
                  </label>
                  <select
                    value={query.type}
                    onChange={e => setQuery({ ...query, type: e.target.value })}
                    className="w-full px-2 py-1 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-2 text-foreground font-mono text-sm"
                  >
                    <option value="STOCK">Stock</option>
                    <option value="INDEX">Index</option>
                    <option value="OPT">Options</option>
                    <option value="FUT">Futures</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Interval
                  </label>
                  <select
                    value={query.interval}
                    onChange={e =>
                      setQuery({ ...query, interval: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-2 text-foreground font-mono text-sm"
                  >
                    <option value="1s">1 second</option>
                    <option value="1m">1 minute</option>
                    <option value="5m">5 minutes</option>
                    <option value="15m">15 minutes</option>
                    <option value="30m">30 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="1d">1 day</option>
                  </select>
                </div>
              </div>

              {/* Symbols and Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Symbols
                  </label>
                  <input
                    type="text"
                    value={query.values.join(', ')}
                    onChange={e =>
                      setQuery({
                        ...query,
                        values: e.target.value.split(',').map(s => s.trim()),
                      })
                    }
                    className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-surface-2 text-foreground font-mono text-xs"
                    placeholder="ASIANPAINT, NIFTY, RELIANCE"
                  />
                  <p className="text-xs text-text-muted">
                    Enter symbols separated by commas
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Data Fields
                  </label>
                  <MultiSelect
                    value={query.fields}
                    onChange={fields => setQuery({ ...query, fields })}
                    options={FIELD_OPTIONS}
                    placeholder="Select data fields..."
                    className="w-full"
                  />
                  <p className="text-xs text-text-muted">
                    Choose multiple fields to retrieve
                  </p>
                </div>
              </div>

              {/* Date Range Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    value={query.startDate.slice(0, 16)}
                    onChange={e =>
                      setQuery({
                        ...query,
                        startDate: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-surface-2 text-foreground font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    value={query.endDate.slice(0, 16)}
                    onChange={e =>
                      setQuery({
                        ...query,
                        endDate: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-surface-2 text-foreground font-mono text-xs"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="text-xs text-text-muted">
                  Configure your query parameters above and click fetch to
                  retrieve data
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors bg-accent-muted text-text-primary hover:bg-accent-muted/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-3 h-3 border border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>Fetch Data</>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded font-mono text-sm">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          {data && (
            <div className="bg-surface-1 rounded-lg border border-border overflow-hidden">
              <HistoricalDataDisplay data={data} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
