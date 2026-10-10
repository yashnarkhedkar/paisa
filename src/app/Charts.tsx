"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

export function CategoryBar({ data, label = "Spent" }: { data: { name: string; value: number }[]; label?: string }) {
  return (
    <div style={{ height: Math.max(120, data.length * 32 + 32) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} vertical stroke={line} />
          <XAxis type="number" tickFormatter={fmt} tick={tick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={100} tick={tick} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipCommon} formatter={(v) => [fmt(v), label]} />
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

// Categorical slots 1-6 from the dataviz reference palette, fixed order. Validated (light): adjacent-pair
// colour-blind separation passes; non-adjacent pairs are close, so the legend names every slice with its value.
const SLICE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];

/** Donut of the top 5 categories + "Other" (a pie stops reading past ~6 slices). */
export function SpendPie({ data }: { data: { name: string; value: number }[] }) {
  const top = data.slice(0, 5);
  const rest = data.slice(5).reduce((s, d) => s + d.value, 0);
  const slices = rest > 0 ? [...top, { name: "Other", value: rest }] : top;
  const total = slices.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270}>
              {slices.map((d, i) => (
                <Cell key={d.name} fill={SLICE[i]} />
              ))}
            </Pie>
            <Tooltip {...tooltipCommon} formatter={(v, n) => [`${fmt(v)} · ${Math.round((Number(v) / total) * 100)}%`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="hint">total</span>
          <span className="font-medium tabular-nums">{inr(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {slices.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SLICE[i] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="tabular-nums">{inr(d.value)}</span>
            <span className="hint w-9 text-right tabular-nums">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
