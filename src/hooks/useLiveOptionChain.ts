/**
 * useLiveOptionChain
 * Step 3 (REST bootstrap) → Step 4 (WebSocket) → Step 5 (subscribe) → Step 6 (process) → Step 8 (update UI)
 * DATA-02, DATA-03, DATA-05, OPS-02
 *
 * In mock mode (no API key), uses a client-side tick simulator for live-looking updates.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { NubraWebSocketManager } from '@/lib/websocket-manager';
import { useDashboardStore } from '@/lib/store';
import { OptionChainSnapshot, WsTick } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const POLL_INTERVAL = 30_000; // 30s REST fallback polling
const MOCK_TICK_INTERVAL = 700; // ms between simulated ticks

// ─── Mock tick simulator ──────────────────────────────────────────────────────
function startMockTicks(
  snapshot: OptionChainSnapshot,
  applyTick: (tick: WsTick) => void,
  setConnectionStatus: (s: Record<string, string>) => void
): ReturnType<typeof setInterval> {
  setConnectionStatus({ ws: 'connected' });

  // Keep mutable state so OI and LTP accumulate realistically across ticks
  const legState: Record<string, { ltp: number; oi: number }> = {};
  for (const row of snapshot.rows) {
    legState[row.call.instrument_token] = {
      ltp: row.call.ltp,
      oi: row.call.oi,
    };
    legState[row.put.instrument_token] = { ltp: row.put.ltp, oi: row.put.oi };
  }

  return setInterval(() => {
    const rows = snapshot.rows;
    if (!rows.length) return;

    // Update 1-3 random legs per tick
    const count = Math.ceil(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const row = rows[Math.floor(Math.random() * rows.length)];
      const isCall = Math.random() > 0.5;
      const leg = isCall ? row.call : row.put;
      const state = legState[leg.instrument_token];
      if (!state) continue;

      const drift = 1 + (Math.random() - 0.48) * 0.016;
      const newLtp = Math.max(0.05, +(state.ltp * drift).toFixed(2));
      const spread = Math.max(0.1, newLtp * 0.008);
      const oiDelta = Math.round((Math.random() - 0.45) * 600);

      state.ltp = newLtp;
      state.oi = Math.max(0, state.oi + oiDelta);

      const tick: WsTick = {
        instrument_token: leg.instrument_token,
        mode: 'full',
        tradable: true,
        exchange_timestamp: Date.now() * 1_000_000,
        last_trade_time: Date.now(),
        ltp: newLtp,
        bid: +(newLtp - spread / 2).toFixed(2),
        ask: +(newLtp + spread / 2).toFixed(2),
        volume: leg.volume + Math.round(Math.random() * 150),
        oi: state.oi,
        greeks: leg.greeks,
        depth: leg.depth,
      };

      applyTick(tick);
    }
  }, MOCK_TICK_INTERVAL);
}

export function useLiveOptionChain() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    sessionToken,
    marketWsUrl,
  } = useAuth();
  const wsManager = useRef<NubraWebSocketManager | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockTickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { filter, setSnapshot, applyTick, setConnectionStatus, setExpiries } =
    useDashboardStore();

  // ── Step 3: Bootstrap with REST snapshot ──────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    if (!filter.expiry) return;

    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      console.log('[useLiveOptionChain] Not authenticated, skipping fetch');
      return;
    }

    setConnectionStatus({ rest: 'loading' });
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(
        `/api/nubra/options-chain?underlying=${filter.underlying}&expiry=${filter.expiry}`,
        { headers }
      );
      if (!res.ok) throw new Error(await res.text());
      const data: OptionChainSnapshot = await res.json();
      setSnapshot(data);
      setConnectionStatus({ rest: 'success' });
      return data;
    } catch (err) {
      console.error('[useLiveOptionChain] REST fetch failed:', err);
      setConnectionStatus({ rest: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filter.underlying,
    filter.expiry,
    setSnapshot,
    setConnectionStatus,
    isAuthenticated,
  ]);

  // ── Fetch expiry list ─────────────────────────────────────────────────────
  const fetchExpiries = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      console.log(
        '[useLiveOptionChain] Not authenticated, skipping expiry fetch'
      );
      return;
    }

    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(
        `/api/nubra/options-chain?underlying=${filter.underlying}&action=expiries`,
        { headers }
      );
      if (!res.ok) return;
      const data = await res.json();
      setExpiries(data.expiries ?? []);
    } catch (err) {
      console.error('[useLiveOptionChain] Expiry fetch failed:', err);
    }
  }, [filter.underlying, setExpiries, isAuthenticated]);

  const stopMockTicks = useCallback(() => {
    if (mockTickTimer.current) {
      clearInterval(mockTickTimer.current);
      mockTickTimer.current = null;
    }
  }, []);

  // ── Step 4 & 5: Connect WebSocket and subscribe ───────────────────────────
  const connectWebSocket = useCallback(
    async (snapshot: OptionChainSnapshot) => {
      const isMock = (snapshot as any).mock === true;

      if (isMock) {
        stopMockTicks();
        mockTickTimer.current = startMockTicks(
          snapshot,
          applyTick,
          setConnectionStatus
        );
        return;
      }

      // Extract exchange, asset, and expiry from snapshot for option chain subscription
      const exchange = 'NSE'; // Default to NSE, should be configurable
      const asset = snapshot.underlying;
      const expiry = snapshot.expiry;

      if (wsManager.current) wsManager.current.disconnect();

      const wsUrl =
        marketWsUrl ||
        process.env.NEXT_PUBLIC_WS_URL ||
        'wss://api.nubra.io/apibatch/ws';
      const ws = new NubraWebSocketManager(wsUrl);
      wsManager.current = ws;

      ws.onStatus(status => setConnectionStatus({ ws: status }));
      ws.onTick((ticks: WsTick[]) => ticks.forEach(t => applyTick(t)));

      try {
        // Use WebSocket token from AuthContext
        if (!sessionToken) {
          throw new Error(
            'No WebSocket token available for WebSocket connection'
          );
        }
        await ws.connect(sessionToken);

        // Enable post-market mode for testing when markets are closed
        //ws.enablePostMarketMode();

        // Subscribe to option chain for real-time updates
        ws.subscribeOptionChain(exchange, asset, expiry);

        // Also subscribe to Greeks for individual instruments if needed
        const tokens = snapshot.rows.flatMap(row => [
          row.call.instrument_token,
          row.put.instrument_token,
        ]);
        if (tokens.length > 0) {
          ws.subscribeGreeks(tokens);
        }

        console.log('[useLiveOptionChain] WebSocket subscriptions established');
      } catch (err) {
        console.error(
          '[useLiveOptionChain] WS connect failed, falling back to polling:',
          err
        );
        startPolling();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyTick, setConnectionStatus, stopMockTicks, isAuthenticated]
  );

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    pollTimer.current = setInterval(fetchSnapshot, POLL_INTERVAL);
  }, [fetchSnapshot]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // ── Main effect: re-run on underlying/expiry change ───────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Only proceed if authentication is stable and successful
      if (authLoading) {
        return;
      }

      if (authError) {
        console.error('[useLiveOptionChain] Authentication error:', authError);
        setConnectionStatus({ auth: 'unauthenticated' });
        return;
      }

      if (!isAuthenticated) {
        console.log('[useLiveOptionChain] Not authenticated');
        setConnectionStatus({ auth: 'unauthenticated' });
        return;
      }

      setConnectionStatus({ auth: 'authenticated' });

      if (cancelled) return;

      const snapshot = await fetchSnapshot();
      if (!snapshot || cancelled) return;

      await connectWebSocket(snapshot);
    }

    if (filter.expiry && isAuthenticated) {
      stopMockTicks();
      init();
    } else {
      console.log(
        '[useLiveOptionChain] WebSocket not initialized - conditions:',
        {
          filterExpiry: !!filter.expiry,
          isAuthenticated,
          authLoading,
          authError,
        }
      );
    }

    return () => {
      cancelled = true;
    };
    // Only depend on filter changes and authentication state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filter.underlying,
    filter.expiry,
    isAuthenticated, // Simplified - just check if authenticated
    fetchSnapshot,
    connectWebSocket,
    stopMockTicks,
  ]);

  useEffect(() => {
    fetchExpiries();
  }, [fetchExpiries]);

  // OPS-03: Cleanup on unmount
  useEffect(() => {
    return () => {
      wsManager.current?.disconnect();
      stopPolling();
      stopMockTicks();
    };
  }, [stopPolling, stopMockTicks]);

  return { fetchSnapshot };
}
