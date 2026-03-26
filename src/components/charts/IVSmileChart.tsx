'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useDashboardStore } from '@/lib/store';
import { toIVChartData } from '@/lib/analytics';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-1 border border-border rounded px-3 py-2 text-[11px] font-mono">
      <div className="text-text-muted mb-1">Strike {label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(2)}%
        </div>
      ))}
    </div>
  );
};

export function IVSmileChart() {
  const { filteredRows, snapshot } = useDashboardStore();
  const data = useMemo(() => toIVChartData(filteredRows), [filteredRows]);

  if (!snapshot || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted font-mono text-xs">
        IV Smile — awaiting data
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-[#2d9cf0] inline-block" />
          Call IV
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-[#ff4560] inline-block" />
          Put IV
        </span>
        <span className="ml-auto">
          IVR: {snapshot.iv_rank?.toFixed(0) ?? '--'}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis
            dataKey="strike"
            tick={{ fill: '#3d5570', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#3d5570', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}%`}
            width={36}
            domain={['auto', 'auto']}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#3d5570', strokeWidth: 0.5 }}
          />
          <ReferenceLine
            x={snapshot.atm_strike}
            stroke="#00d97e"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <Line
            dataKey="callIV"
            name="Call IV"
            stroke="#2d9cf0"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#2d9cf0' }}
          />
          <Line
            dataKey="putIV"
            name="Put IV"
            stroke="#ff4560"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#ff4560' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
