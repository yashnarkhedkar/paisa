"use client";

import { useState, useTransition } from "react";
import { setCategory } from "./actions";
import { merchantKeyword } from "@/lib/categorise";

type Props = {
  id: number;
  date: string;
  description: string;
  accountCode: string;
  amount: number;
  categoryId: number | null;
  categories: { id: number; name: string }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Row({ id, date, description, accountCode, amount, categoryId, categories }: Props) {
  const [remember, setRemember] = useState(false);
  const [pending, start] = useTransition();
  const kw = merchantKeyword(description);
  const uncategorised = categoryId === null;
  const day = `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

  return (
    <div
      className={`px-4 py-3 text-sm ${pending ? "opacity-50" : ""} ${uncategorised ? "border-l-2 border-amber-400" : ""}`}
    >
      {/* line 1: merchant + amount */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 truncate font-medium" title={description}>
          {description}
        </span>
        <span className={`shrink-0 font-medium ${amount < 0 ? "amount-neg" : "amount-pos"}`}>
          {amount < 0 ? "−" : "+"}₹{Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>

      {/* line 2: meta + category control */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
        <span className="shrink-0 tabular-nums">{day}</span>
        <span className="pill shrink-0">{accountCode}</span>
        <span className="hidden flex-1 sm:block" />
        <select
          className={`select ml-auto w-auto shrink-0 py-1 text-xs ${uncategorised ? "border-amber-400" : ""}`}
          value={categoryId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            start(() => setCategory(id, v ? Number(v) : null, remember));
          }}
        >
          <option value="">Pick category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label
          className={`flex min-w-0 items-center gap-1 ${kw ? "" : "opacity-40"}`}
          title={kw ? `Saves rule "${kw}" and applies to future rows` : "Description too generic to make a rule"}
        >
          <input type="checkbox" checked={remember} disabled={!kw} onChange={(e) => setRemember(e.target.checked)} />
          <span className="min-w-0 truncate">{kw ? `remember "${kw}"` : "remember"}</span>
        </label>
      </div>
    </div>
  );
}
