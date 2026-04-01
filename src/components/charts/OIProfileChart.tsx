'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ComposedChart,
} from 'recharts';
import { useDashboardStore } from '@/lib/store';
import { toOIChartData } from '@/lib/analytics';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-1 border border-border rounded px-3 py-2 text-[11px] font-mono">
      <div className="text-text-muted mb-1">Strike {label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}K
        </div>
      ))}
    </div>
  );
};

export function OIProfileChart() {
  const { filteredRows, snapshot, emaPeriod, showEMA } = useDashboardStore();
  const data = useMemo(
    () => toOIChartData(filteredRows, emaPeriod),
    [filteredRows, emaPeriod]
  );

  if (!snapshot || data.length === 0) {
    return <EmptyChart label="OI Profile" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#2d9cf0] inline-block" />
          Call OI
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#ff4560] inline-block" />
          Put OI
        </span>
        {showEMA && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] inline-block" />
              Call EMA({emaPeriod})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6] inline-block" />
              Put EMA({emaPeriod})
            </span>
          </>
        )}
        <span className="ml-auto text-[10px]">
          ATM: {snapshot.atm_strike.toLocaleString('en-IN')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} barCategoryGap="20%" barGap={1}>
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
            tickFormatter={v => `${v}K`}
            width={36}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <ReferenceLine
            x={snapshot.atm_strike}
            stroke="#00d97e"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <Bar
            dataKey="callOI"
            name="Call OI"
            fill="#2d9cf0"
            opacity={0.8}
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="putOI"
            name="Put OI"
            fill="#ff4560"
            opacity={0.8}
            radius={[2, 2, 0, 0]}
          />
          {showEMA && (
            <>
              <Line
                type="monotone"
                dataKey="callOIEMA"
                name={`Call EMA(${emaPeriod})`}
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="putOIEMA"
                name={`Put EMA(${emaPeriod})`}
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OIChangeChart() {
  const { filteredRows, snapshot } = useDashboardStore();
  const data = useMemo(() => toOIChartData(filteredRows), [filteredRows]);

  if (!snapshot || data.length === 0) return <EmptyChart label="OI Change" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-mono text-text-muted">
        OI Build-up / Unwinding (K)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barCategoryGap="20%" barGap={1}>
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
            tickFormatter={v => `${v}K`}
            width={36}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <ReferenceLine y={0} stroke="#3d5570" strokeWidth={0.5} />
          <ReferenceLine
            x={snapshot.atm_strike}
            stroke="#00d97e"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <Bar dataKey="callOIChange" name="Call Chg" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.callOIChange >= 0 ? '#2d9cf0' : '#2d9cf066'}
              />
            ))}
          </Bar>
          <Bar dataKey="putOIChange" name="Put Chg" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.putOIChange >= 0 ? '#ff4560' : '#ff456066'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-text-muted font-mono text-xs">
      {label} — awaiting data
    </div>
  );
}
