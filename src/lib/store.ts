/**
 * Dashboard State Store (Zustand)
 * Central state for option chain data, WebSocket ticks, filters, UI state
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  OptionChainSnapshot,
  OptionChainRow,
  WsTick,
  DashboardFilter,
  ConnectionStatus,
  FlashState,
  ActiveTab,
  Underlying,
  Order,
} from '@/types';
import { calculateMaxPain, calculatePCR, calculateGEX } from '@/lib/analytics';

// Expiry object type
interface ExpiryOption {
  raw: string;
  formatted: string;
}

interface DashboardStore {
  // ── Snapshot ───────────────────────────────────────────────────────────────
  snapshot: OptionChainSnapshot | null;
  rows: OptionChainRow[];
  filteredRows: OptionChainRow[];
  expiries: ExpiryOption[];

  // ── Filters ────────────────────────────────────────────────────────────────
  filter: DashboardFilter;
  emaPeriod: number;
  showEMA: boolean;

  // ── Connection ─────────────────────────────────────────────────────────────
  connectionStatus: ConnectionStatus;

  // ── UI ─────────────────────────────────────────────────────────────────────
  activeTab: ActiveTab;
  flashState: FlashState;
  selectedStrike: number | null;
  selectedSide: 'call' | 'put' | null;
  isChartModalOpen: boolean;

  // ── Derived metrics ────────────────────────────────────────────────────────
  maxPain: number;
  pcr: number;
  ivRank: number;
  lastUpdateTime: Date | null;

  // ── Orders ─────────────────────────────────────────────────────────────────
  orders: Order[];

  // ── Actions ────────────────────────────────────────────────────────────────
  setSnapshot: (snapshot: OptionChainSnapshot) => void;
  applyTick: (tick: WsTick) => void;
  setFilter: (filter: Partial<DashboardFilter>) => void;
  setConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  setActiveTab: (tab: ActiveTab) => void;
  selectStrike: (strike: number, side: 'call' | 'put') => void;
  setExpiries: (expiries: ExpiryOption[]) => void;
  setOrders: (orders: Order[]) => void;
  setIsChartModalOpen: (isOpen: boolean) => void;
  setEmaPeriod: (period: number) => void;
  setShowEMA: (show: boolean) => void;
}

const defaultFilter: DashboardFilter = {
  underlying: 'NIFTY',
  expiry: '',
  strikeRange: 15,
  showGreeks: false,
  showDepth: false,
};

export const useDashboardStore = create<DashboardStore>()(
  subscribeWithSelector((set, get) => ({
    snapshot: null,
    rows: [],
    filteredRows: [],
    expiries: [],
    filter: defaultFilter,
    emaPeriod: 9,
    showEMA: false,
    connectionStatus: {
      ws: 'disconnected',
      rest: 'idle',
      auth: 'unauthenticated',
    },
    activeTab: 'oi',
    flashState: {},
    selectedStrike: null,
    selectedSide: null,
    isChartModalOpen: false,
    maxPain: 0,
    pcr: 0,
    ivRank: 0,
    lastUpdateTime: null,
    orders: [],

    setSnapshot: snapshot => {
      const maxPain = calculateMaxPain(snapshot.rows);
      const pcr = calculatePCR(snapshot.rows);

      // Apply strike range filter
      const atm = snapshot.atm_strike;
      const { strikeRange } = get().filter;

      // Determine step from rows
      const step =
        snapshot.rows.length > 1
          ? snapshot.rows[1].strike - snapshot.rows[0].strike
          : 50;

      const filteredRows = snapshot.rows.filter(
        r =>
          r.strike >= atm - strikeRange * step &&
          r.strike <= atm + strikeRange * step
      );

      set({
        snapshot,
        rows: snapshot.rows,
        filteredRows,
        maxPain,
        pcr,
        ivRank: snapshot.iv_rank ?? 0,
        lastUpdateTime: new Date(),
      });
    },

    applyTick: tick => {
      const { rows, snapshot } = get();
      if (!snapshot) return;

      // Find which row this tick belongs to
      const newRows = rows.map(row => {
        let updated = false;
        let updatedRow = { ...row };

        if (row.call.instrument_token === tick.instrument_token) {
          const prevLTP = row.call.ltp;
          updatedRow = {
            ...row,
            call: {
              ...row.call,
              ltp: tick.ltp ?? row.call.ltp,
              bid: tick.bid ?? row.call.bid,
              ask: tick.ask ?? row.call.ask,
              oi: tick.oi ?? row.call.oi,
              volume: tick.volume ?? row.call.volume,
              greeks: tick.greeks ?? row.call.greeks,
              depth: tick.depth ?? row.call.depth,
              exchange_timestamp: tick.exchange_timestamp,
            },
          };

          // Flash state
          const direction = (tick.ltp ?? prevLTP) > prevLTP ? 'up' : 'down';
          scheduleFlash(tick.instrument_token, direction, set);
          updated = true;
        }

        if (row.put.instrument_token === tick.instrument_token) {
          const prevLTP = row.put.ltp;
          updatedRow = {
            ...updatedRow,
            put: {
              ...row.put,
              ltp: tick.ltp ?? row.put.ltp,
              bid: tick.bid ?? row.put.bid,
              ask: tick.ask ?? row.put.ask,
              oi: tick.oi ?? row.put.oi,
              volume: tick.volume ?? row.put.volume,
              greeks: tick.greeks ?? row.put.greeks,
              depth: tick.depth ?? row.put.depth,
              exchange_timestamp: tick.exchange_timestamp,
            },
          };
          const direction = (tick.ltp ?? prevLTP) > prevLTP ? 'up' : 'down';
          scheduleFlash(tick.instrument_token, direction, set);
          updated = true;
        }

        return updated ? updatedRow : row;
      });

      const { strikeRange } = get().filter;
      const atm = snapshot.atm_strike;
      const step =
        newRows.length > 1 ? newRows[1].strike - newRows[0].strike : 50;

      const filteredRows = newRows.filter(
        r =>
          r.strike >= atm - strikeRange * step &&
          r.strike <= atm + strikeRange * step
      );

      set({
        rows: newRows,
        filteredRows,
        lastUpdateTime: new Date(),
      });
    },

    setFilter: partial => {
      const filter = { ...get().filter, ...partial };
      const { rows, snapshot } = get();

      if (!snapshot) {
        set({ filter });
        return;
      }

      const atm = snapshot.atm_strike;
      const step = rows.length > 1 ? rows[1].strike - rows[0].strike : 50;

      const filteredRows = rows.filter(
        r =>
          r.strike >= atm - filter.strikeRange * step &&
          r.strike <= atm + filter.strikeRange * step
      );

      set({ filter, filteredRows });
    },

    setConnectionStatus: partial => {
      set(s => ({
        connectionStatus: { ...s.connectionStatus, ...partial },
      }));
    },

    setActiveTab: tab => set({ activeTab: tab }),

    selectStrike: (strike, side) =>
      set({ selectedStrike: strike, selectedSide: side }),

    setExpiries: expiries => {
      set({ expiries });
      if (expiries.length > 0 && !get().filter.expiry) {
        set(s => ({ filter: { ...s.filter, expiry: expiries[0].raw } }));
      }
    },

    setOrders: orders => set({ orders }),

    setIsChartModalOpen: isOpen => set({ isChartModalOpen: isOpen }),

    setEmaPeriod: period => set({ emaPeriod: period }),

    setShowEMA: show => set({ showEMA: show }),
  }))
);

// Flash helper — clears flash after 400ms
function scheduleFlash(
  token: string,
  direction: 'up' | 'down',
  set: (partial: Partial<DashboardStore>) => void
) {
  //set((s: DashboardStore) => ({
  //  flashState: { ...s.flashState, [token]: direction },
  //}));
  //setTimeout(() => {
  //  set((s: DashboardStore) => ({
  //    flashState: { ...s.flashState, [token]: null },
  //  }));
  //}, 400);
}
