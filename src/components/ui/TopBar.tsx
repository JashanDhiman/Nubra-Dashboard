"use client";

import { useDashboardStore } from "@/lib/store";
import { Underlying } from "@/types";
import { formatPrice, formatPct } from "@/lib/analytics";
import clsx from "clsx";

const UNDERLYINGS: Underlying[] = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"];

export function TopBar() {
  const { snapshot, filter, expiries, setFilter } = useDashboardStore();
  const spot = snapshot?.spot ?? 0;
  const chgPct = snapshot?.spot_change_pct ?? 0;
  const isUp = chgPct >= 0;

  return (
    <header className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-surface-1 flex-wrap">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-2">
        <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse-dot" />
        <span className="font-mono text-xs tracking-widest text-text-secondary uppercase">
          Nubra Options
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Underlying selector */}
      <div className="flex items-center gap-1">
        {UNDERLYINGS.map((u) => (
          <button
            key={u}
            onClick={() => setFilter({ underlying: u })}
            className={clsx(
              "px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors",
              filter.underlying === u
                ? "bg-accent-muted text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
            )}
          >
            {u}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Expiry */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Expiry</span>
        <select
          value={filter.expiry}
          onChange={(e) => setFilter({ expiry: e.target.value })}
          className="bg-surface-3 border border-border text-text-primary text-[11px] font-mono px-2 py-1 rounded outline-none focus:border-accent-muted"
        >
          {expiries.length === 0 && <option value="">Loading...</option>}
          {expiries.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* Spot price */}
      <div className="ml-auto flex items-center gap-3">
        {spot > 0 && (
          <>
            <span className="text-text-muted font-mono text-[11px]">{filter.underlying}</span>
            <span className="font-mono text-lg font-medium text-text-primary tracking-tight">
              {formatPrice(spot)}
            </span>
            <span className={clsx("font-mono text-xs", isUp ? "text-accent-green" : "text-accent-red")}>
              {isUp ? "▲" : "▼"} {formatPct(Math.abs(chgPct))}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
