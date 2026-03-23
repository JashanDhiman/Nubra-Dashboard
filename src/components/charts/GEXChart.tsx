"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useDashboardStore } from "@/lib/store";
import { toGEXChartData, formatLargeNumber } from "@/lib/analytics";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="bg-surface-1 border border-border rounded px-3 py-2 text-[11px] font-mono">
      <div className="text-text-muted mb-1">Strike {label}</div>
      <div style={{ color: v >= 0 ? "#00d97e" : "#ff4560" }}>
        GEX: {v >= 0 ? "+" : ""}{v.toFixed(2)}M
      </div>
      <div className="text-text-muted text-[10px] mt-0.5">
        {v >= 0 ? "Dealers long gamma (stabilizing)" : "Dealers short gamma (volatile)"}
      </div>
    </div>
  );
};

export function GEXChart() {
  const { filteredRows, snapshot } = useDashboardStore();
  const data = useMemo(
    () => (snapshot ? toGEXChartData(filteredRows, snapshot.spot) : []),
    [filteredRows, snapshot]
  );

  if (!snapshot || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted font-mono text-xs">
        GEX — awaiting data
      </div>
    );
  }

  const netGEX = data.reduce((acc, d) => acc + d.gex, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#00d97e] inline-block" />
            Long gamma
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#ff4560] inline-block" />
            Short gamma
          </span>
        </div>
        <span style={{ color: netGEX >= 0 ? "#00d97e" : "#ff4560" }}>
          Net GEX: {netGEX >= 0 ? "+" : ""}{netGEX.toFixed(1)}M
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="20%">
          <XAxis
            dataKey="strike"
            tick={{ fill: "#3d5570", fontSize: 9, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#3d5570", fontSize: 9, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}M`}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <ReferenceLine y={0} stroke="#3d5570" strokeWidth={0.5} />
          <ReferenceLine
            x={snapshot.atm_strike}
            stroke="#00d97e"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <Bar dataKey="gex" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.gex >= 0 ? "#00d97e" : "#ff4560"}
                opacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
