"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { inr } from "@/lib/format";

const ink = "#111113";
const muted = "#6b6b73";
const line = "#e7e7ea";
const fmt = (v: unknown) => inr(Number(v));
const tick = { fontSize: 11, fill: muted };
const tooltipStyle = {
  background: "#fff",
  border: `1px solid ${line}`,
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
  boxShadow: "none",
};
const tooltipCommon = {
  contentStyle: tooltipStyle,
  labelStyle: { color: muted, marginBottom: 2 },
  itemStyle: { color: ink, padding: 0 },
  cursor: { fill: "rgba(17,17,19,0.04)" },
};

export function CategoryBar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div style={{ height: Math.max(220, data.length * 28) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} vertical stroke={line} />
          <XAxis type="number" tickFormatter={fmt} tick={tick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={100} tick={tick} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipCommon} formatter={(v) => [fmt(v), "Spent"]} />
          <Bar dataKey="value" fill={ink} fillOpacity={0.85} radius={3} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyArea({ data }: { data: { day: number; total: number }[] }) {
  return (
    <div className="w-full" style={{ height: 220 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={line} />
          <XAxis dataKey="day" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={tick} width={70} axisLine={false} tickLine={false} />
          <Tooltip
            {...tooltipCommon}
            cursor={{ stroke: line }}
            formatter={(v) => [fmt(v), "Cumulative"]}
            labelFormatter={(d) => `Day ${d}`}
          />
          <Area dataKey="total" stroke={ink} strokeWidth={1.5} fill={ink} fillOpacity={0.08} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
