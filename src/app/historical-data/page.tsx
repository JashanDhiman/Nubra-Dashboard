'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        setError('Please login first');
        return;
      }

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

  const renderData = () => {
    if (!data || !data.result.length) return null;

    const result = data.result[0];
    const symbol = Object.keys(result.values[0])[0];
    const symbolData = result.values[0][symbol];

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">
          {result.exchange} - {symbol} ({result.type})
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(symbolData).map(([field, points]) => (
            <div key={field} className="bg-white p-4 rounded-lg shadow">
              <h4 className="font-medium mb-2 capitalize">{field}</h4>
              <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Time</th>
                      <th className="px-2 py-1 text-left">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.slice(0, 10).map((point, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-2 py-1">
                          {formatTimestamp(point.ts)}
                        </td>
                        <td className="px-2 py-1">{point.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {points.length > 10 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Showing first 10 of {points.length} points
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Historical Market Data
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Exchange */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exchange
                </label>
                <select
                  value={query.exchange}
                  onChange={e =>
                    setQuery({ ...query, exchange: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={query.type}
                  onChange={e => setQuery({ ...query, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="STOCK">Stock</option>
                  <option value="INDEX">Index</option>
                  <option value="OPT">Options</option>
                  <option value="FUT">Futures</option>
                </select>
              </div>

              {/* Symbols */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symbols (comma-separated)
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ASIANPAINT, NIFTY, RELIANCE"
                />
              </div>

              {/* Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fields (comma-separated)
                </label>
                <input
                  type="text"
                  value={query.fields.join(', ')}
                  onChange={e =>
                    setQuery({
                      ...query,
                      fields: e.target.value.split(',').map(s => s.trim()),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="value, open, high, low, close, volume"
                />
              </div>

              {/* Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interval
                </label>
                <select
                  value={query.interval}
                  onChange={e =>
                    setQuery({ ...query, interval: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
            >
              {loading ? 'Fetching...' : 'Fetch Data'}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {data && renderData()}
        </div>
      </div>
    </div>
  );
}
