import Link from "next/link";
import { db } from "@/lib/db";
import { LOCKED, merchantKeyword } from "@/lib/categorise";
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
  // friends paying back their share cut your spending; they are not income
  const reimbursed = txns
    .filter((t) => t.amount > 0 && t.category?.name === "Reimbursement")
    .reduce((s, t) => s + t.amount, 0);
  const spent = spendTx.reduce((s, t) => s - t.amount, 0) - reimbursed;
  const income = txns
    .filter((t) => t.amount > 0 && t.category?.name === "Income")
    .reduce((s, t) => s + t.amount, 0);
  const net = income - spent;
  const uncat = txns.filter((t) => t.categoryId === null).length;

  // Money in: new money only. Own-account transfers and savings coming back (FD maturity) are not new money;
  // the latter shows as "came back" in the investments card.
  const isSaving = (c: { name: string; isSpending: boolean } | null) => !!c && !c.isSpending && !LOCKED.includes(c.name);
  const inMap = new Map<string, number>();
  let movedIn = 0;
  for (const t of txns) {
    if (t.amount <= 0) continue;
    if (t.category?.name === "Transfer" || isSaving(t.category)) movedIn += t.amount;
    else inMap.set(t.category?.name ?? "Uncategorised", (inMap.get(t.category?.name ?? "Uncategorised") ?? 0) + t.amount);
  }
  const moneyIn = [...inMap].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Savings & investments: non-spending categories that aren't income/transfer/reimbursement (Gold, FD, Investment...).
  // Out = put in, in = came back (FD maturity, sold stock); net = what stayed invested this month.
  const invMap = new Map<string, { out: number; in: number }>();
  for (const t of txns) {
    const c = t.category;
    if (!c || !isSaving(c)) continue;
    const v = invMap.get(c.name) ?? { out: 0, in: 0 };
    if (t.amount < 0) v.out -= t.amount;
    else v.in += t.amount;
    invMap.set(c.name, v);
  }
  const invest = [...invMap].map(([name, v]) => ({ name, ...v, net: v.out - v.in })).sort((a, b) => b.net - a.net);
  const investNet = invest.reduce((s, i) => s + i.net, 0);

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
    // same payee key as "group similar" on /transactions, so 4 UPI payments to one person are one line
    const k = merchantKeyword(t.description) || t.description.trim().toUpperCase();
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

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">Money in</h2>
          {moneyIn.length ? <CategoryBar data={moneyIn} label="Received" /> : <p className="muted">Nothing came in.</p>}
          {movedIn > 0 && <p className="hint mt-2">{inr(movedIn)} was your own money (account transfers, savings coming back), not counted.</p>}
        </div>
        <div className="card">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="h2">Savings &amp; investments</h2>
            <span className={`font-medium tabular-nums ${investNet >= 0 ? "text-pos" : "text-neg"}`}>{inr(investNet)} net</span>
          </div>
          {invest.length === 0 ? (
            <p className="muted">Nothing invested this month. Tag FD, gold, SIP rows with a non-spending category.</p>
          ) : (
            <div className="divide-rows -mx-4 text-sm">
              <div className="hint flex gap-3 px-4 pb-2">
                <span className="flex-1">Category</span>
                <span className="w-20 text-right">Put in</span>
                <span className="w-20 text-right">Came back</span>
                <span className="w-20 text-right">Net</span>
              </div>
              {invest.map((i) => (
                <div key={i.name} className="flex gap-3 px-4 py-2 tabular-nums">
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="w-20 text-right">{inr(i.out)}</span>
                  <span className="w-20 text-right text-muted">{i.in ? inr(i.in) : "—"}</span>
                  <span className="w-20 text-right font-medium">{inr(i.net)}</span>
                </div>
              ))}
            </div>
          )}
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
