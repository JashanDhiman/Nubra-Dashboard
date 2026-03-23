"use client";

import { useDashboardStore } from "@/lib/store";
import { getPCRSignal, formatOI, formatStrike } from "@/lib/analytics";
import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}

function StatCard({ label, value, sub, subColor }: StatCardProps) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 border-r border-border last:border-r-0">
      <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">{label}</span>
      <span className="text-base font-mono font-medium text-text-primary">{value}</span>
      {sub && (
        <span className="text-[10px] font-mono" style={{ color: subColor }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function StatsRow() {
  const { snapshot, maxPain, pcr, ivRank } = useDashboardStore();

  if (!snapshot) {
    return (
      <div className="grid grid-cols-6 border-b border-border bg-surface-1 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-r border-border last:border-r-0">
            <div className="h-2 w-16 bg-surface-3 rounded mb-2" />
            <div className="h-4 w-24 bg-surface-3 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const pcrSignal = getPCRSignal(pcr);
  const totalCallOI = formatOI(snapshot.total_call_oi);
  const totalPutOI = formatOI(snapshot.total_put_oi);
  const maxPainStr = formatStrike(maxPain);
  const atmStr = formatStrike(snapshot.atm_strike);
  const ivRankColor = ivRank > 80 ? "#ff4560" : ivRank > 50 ? "#f59e0b" : "#00d97e";

  return (
    <div className="grid grid-cols-6 border-b border-border bg-surface-1">
      <StatCard
        label="ATM Strike"
        value={atmStr}
        sub={`Spot: ${snapshot.spot.toLocaleString("en-IN")}`}
        subColor="#7a8fa6"
      />
      <StatCard
        label="PCR (OI)"
        value={pcr.toFixed(2)}
        sub={pcrSignal.label}
        subColor={pcrSignal.color}
      />
      <StatCard
        label="Call OI"
        value={totalCallOI}
        sub={`${snapshot.rows.length} strikes`}
        subColor="#2d9cf0"
      />
      <StatCard
        label="Put OI"
        value={totalPutOI}
        sub={`${snapshot.rows.length} strikes`}
        subColor="#ff4560"
      />
      <StatCard
        label="Max Pain"
        value={maxPainStr}
        sub={`${Math.abs(snapshot.spot - maxPain).toFixed(0)} pts ${snapshot.spot > maxPain ? "above" : "below"}`}
        subColor="#f59e0b"
      />
      <StatCard
        label="IV Rank"
        value={`${ivRank.toFixed(0)}%`}
        sub={ivRank > 80 ? "High IV — sell premium" : ivRank < 30 ? "Low IV — buy options" : "Moderate IV"}
        subColor={ivRankColor}
      />
    </div>
  );
}
