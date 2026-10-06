import Link from "next/link";
import { db } from "@/lib/db";
import { inr, monthKey } from "@/lib/format";
import { CategoryBar, DailyArea } from "./Charts";

function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)) };
}
const shift = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, mo - 1 + by, 1)));
};
const monthTitle = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default async function Home({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const current = monthKey(new Date());
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : current;
  const { start, end } = monthRange(month);

  const raw = await db.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    include: { category: true },
  });
  const txns = raw.map((t) => ({ ...t, amount: Number(t.amount) }));

  const spendTx = txns.filter((t) => t.amount < 0 && (t.category?.isSpending ?? true));
  const spent = spendTx.reduce((s, t) => s - t.amount, 0);
  const income = txns
    .filter((t) => t.amount > 0 && t.category?.name === "Income")
    .reduce((s, t) => s + t.amount, 0);
  const net = income - spent;
  const uncat = txns.filter((t) => t.categoryId === null).length;

  const byCatMap = new Map<string, number>();
  for (const t of spendTx) {
    const k = t.category?.name ?? "Uncategorised";
    byCatMap.set(k, (byCatMap.get(k) ?? 0) - t.amount);
  }
  const byCat = [...byCatMap].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const days = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const perDay = new Array<number>(days + 1).fill(0);
  for (const t of spendTx) perDay[t.date.getUTCDate()] -= t.amount;
  const daily: { day: number; total: number }[] = [];
  let run = 0;
  for (let d = 1; d <= days; d++) {
    run += perDay[d];
    daily.push({ day: d, total: run });
  }

  const merch = new Map<string, { total: number; count: number }>();
  for (const t of spendTx) {
    const k = t.description.trim().toUpperCase();
    const m = merch.get(k) ?? { total: 0, count: 0 };
    m.total -= t.amount;
    m.count++;
    merch.set(k, m);
  }
  const top = [...merch]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const nav = (
    <div className="mb-6 flex items-center justify-between gap-3">
      <h1 className="h1">{monthTitle(month)}</h1>
      <div className="flex items-center gap-2">
        {month !== current && (
          <Link href="/" className="btn btn-sm">
            This month
          </Link>
        )}
        <Link href={`/?month=${shift(month, -1)}`} className="btn btn-sm" aria-label="Previous month">
          &lsaquo;
        </Link>
        <Link href={`/?month=${shift(month, 1)}`} className="btn btn-sm" aria-label="Next month">
          &rsaquo;
        </Link>
      </div>
    </div>
  );

  if (txns.length === 0)
    return (
      <div>
        {nav}
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="muted">No transactions for {monthTitle(month)}.</p>
          <Link href="/upload" className="btn-primary mt-2">
            Upload a statement
          </Link>
        </div>
      </div>
    );

  const stat = (label: string, value: string, cls = "") => (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`}>{value}</div>
    </div>
  );

  return (
    <div>
      {nav}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Spent", inr(spent), "text-neg")}
        {stat("Income", inr(income), "text-pos")}
        {stat("Net", inr(net), net < 0 ? "text-neg" : "text-pos")}
        <Link
          href={`/transactions?month=${month}&category=none`}
          className={`card transition hover:bg-bg ${uncat > 0 ? "bg-[#fff8e6] border-[#f3e3b5]" : ""}`}
        >
          <div className={`stat-label ${uncat > 0 ? "text-[#92400e]" : ""}`}>Uncategorised</div>
          <div className="stat-value">{uncat}</div>
          <div className="hint mt-1">tap to fix</div>
        </Link>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">Spend by category</h2>
          <CategoryBar data={byCat} />
        </div>
        <div className="card">
          <h2 className="h2 mb-3">Cumulative spend</h2>
          <DailyArea data={daily} />
        </div>
      </div>

      <h2 className="h2 mb-2">Top merchants</h2>
      <div className="card-tight divide-rows">
        {top.map((m) => (
          <div key={m.name} className="row text-sm">
            <span className="min-w-0 flex-1 truncate" title={m.name}>
              {m.name}
            </span>
            <span className="pill">{m.count}</span>
            <span className="w-24 text-right tabular-nums">{inr(m.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
