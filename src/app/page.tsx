import Link from "next/link";
import { db } from "@/lib/db";
import { merchantKeyword, payer } from "@/lib/categorise";
import { isSaving, summarise } from "@/lib/summary";
import { inr, monthKey } from "@/lib/format";
import { DailyArea, SpendPie, TrendLines } from "./Charts";

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

  // one query for the 6-month window: this month, last month (deltas) and the trend all come from it
  const trendStart = monthRange(shift(month, -5)).start;
  const [raw, goalsRaw, fixedRaw, budgetCats] = await Promise.all([
    db.transaction.findMany({ where: { date: { gte: trendStart, lt: end } }, include: { category: true, account: true } }),
    db.goal.findMany({ orderBy: { createdAt: "asc" } }),
    db.fixedPayment.findMany({ orderBy: { amount: "desc" } }),
    db.category.findMany({ where: { budget: { not: null } }, orderBy: { name: "asc" } }),
  ]);
  const all = raw.map((t) => ({ ...t, amount: Number(t.amount) }));
  const inMonth = (m: string) => all.filter((t) => monthKey(t.date) === m);
  const txns = inMonth(month);
  const cur = summarise(txns);
  const prevMonth = shift(month, -1);
  const prev = summarise(inMonth(prevMonth));
  const trend = Array.from({ length: 6 }, (_, i) => shift(month, i - 5)).map((m) => ({
    month: monthTitle(m).slice(0, 3),
    ...summarise(inMonth(m)),
  }));

  const spendTx = txns.filter((t) => t.amount < 0 && (t.category?.isSpending ?? true));
  const reimbursed = txns.filter((t) => t.amount > 0 && t.category?.name === "Reimbursement").reduce((s, t) => s + t.amount, 0);
  const { spent, income, net, saved: investNet } = cur;
  const uncat = txns.filter((t) => t.categoryId === null).length;

  // Top money in: who sent money, grouped by sender. Card credits are you paying the bill, so skipped.
  const inMap = new Map<string, { name: string; total: number; count: number; category: string }>();
  for (const t of txns) {
    if (t.amount <= 0 || t.account.kind === "CARD") continue;
    const name = payer(t.description);
    const v = inMap.get(name.toLowerCase()) ?? { name, total: 0, count: 0, category: t.category?.name ?? "Uncategorised" };
    v.total += t.amount;
    v.count += 1;
    inMap.set(name.toLowerCase(), v);
  }
  const moneyIn = [...inMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);

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

  const byCatMap = new Map<string, number>();
  for (const t of spendTx) {
    const k = t.category?.name ?? "Uncategorised";
    byCatMap.set(k, (byCatMap.get(k) ?? 0) - t.amount);
  }
  // Budgets compare this month's spend per category (before paybacks; those aren't tied to a category)
  const budgets = budgetCats.map((c) => {
    const used = byCatMap.get(c.name) ?? 0;
    const limit = Number(c.budget);
    return { name: c.name, used, limit, pct: limit > 0 ? used / limit : 0 };
  });

  // Goal progress = already saved + net put into its category since countFrom (all months, not just this one)
  const today = new Date();
  const goals = await Promise.all(
    goalsRaw.map(async (g) => {
      const agg = g.categoryId
        ? await db.transaction.aggregate({ where: { categoryId: g.categoryId, date: { gte: g.countFrom } }, _sum: { amount: true } })
        : null;
      const have = Number(g.base) - Number(agg?._sum.amount ?? 0);
      const target = Number(g.target);
      const monthsLeft = g.deadline
        ? // months from today (not the month being viewed) to the deadline
          Math.max(1, (g.deadline.getUTCFullYear() - today.getUTCFullYear()) * 12 + g.deadline.getUTCMonth() - today.getUTCMonth())
        : null;
      return { id: g.id, name: g.name, have, target, deadline: g.deadline, perMonth: monthsLeft ? Math.max(0, (target - have) / monthsLeft) : null };
    }),
  );

  const fixed = fixedRaw.map((f) => ({ id: f.id, name: f.name, amount: Number(f.amount) }));
  const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0);

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

  const prevName = monthTitle(prevMonth).slice(0, 3);
  // "↑ 12% vs Aug". For Spent, up is bad; for Income/Saved, up is good. Arrow + words carry the meaning, colour only helps.
  const delta = (now: number, before: number, upIsGood: boolean) => {
    if (!before) return undefined;
    const pct = Math.round(((now - before) / Math.abs(before)) * 100);
    if (pct === 0) return { text: `same as ${prevName}`, cls: "text-muted" };
    const good = pct > 0 === upIsGood;
    // a tiny last month makes % meaningless ("28787%"), so show the rupee change instead
    const size = Math.abs(pct) > 300 ? inr(Math.abs(now - before)) : `${Math.abs(pct)}%`;
    return { text: `${pct > 0 ? "↑" : "↓"} ${size} vs ${prevName}`, cls: good ? "text-pos" : "text-neg" };
  };
  const stat = (label: string, value: string, cls = "", sub?: string, d?: { text: string; cls: string }) => (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`}>{value}</div>
      {d && <div className={`mt-1 text-xs font-medium ${d.cls}`}>{d.text}</div>}
      {sub && <div className="hint mt-1">{sub}</div>}
    </div>
  );
  const saveRate = income > 0 ? Math.round((investNet / income) * 100) : null;
  const bar = (pct: number, color: string) => (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: color }} />
    </div>
  );
  // status palette (dataviz reference): good / warning / critical, always next to a text label
  const budgetColor = (pct: number) => (pct > 1 ? "#d03b3b" : pct >= 0.8 ? "#fab219" : "#0ca30c");
  const empty = (text: string) => (
    <p className="muted">
      {text}{" "}
      <Link href="/plan" className="underline">
        Set up on Plan
      </Link>
    </p>
  );

  return (
    <div>
      {nav}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stat("Spent", inr(spent), "text-neg", reimbursed > 0 ? `${inr(spent + reimbursed)} before friends paid back` : undefined, delta(spent, prev.spent, false))}
        {stat("Income", inr(income), "text-pos", undefined, delta(income, prev.income, true))}
        {stat("Saved", inr(investNet), investNet < 0 ? "text-neg" : "text-pos", saveRate !== null ? `${saveRate}% of income` : undefined, delta(investNet, prev.saved, true))}
        {stat("Net", inr(net), net < 0 ? "text-neg" : "text-pos", "income − spent")}
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
          <SpendPie data={byCat} />
        </div>
        <div className="card">
          <h2 className="h2 mb-3">Last 6 months</h2>
          <TrendLines data={trend} />
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">Budgets</h2>
          {budgets.length === 0
            ? empty("No budgets yet.")
            : (
              <ul className="space-y-3 text-sm">
                {budgets.map((b) => (
                  <li key={b.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{b.name}</span>
                      <span className="tabular-nums">
                        {inr(b.used)} <span className="text-muted">of {inr(b.limit)}</span>
                      </span>
                    </div>
                    {bar(b.pct, budgetColor(b.pct))}
                    <div className={`mt-1 text-xs ${b.pct > 1 ? "text-neg font-medium" : "text-muted"}`}>
                      {b.pct > 1 ? `Over by ${inr(b.used - b.limit)}` : b.pct >= 0.8 ? `${Math.round(b.pct * 100)}% used, close to limit` : `${inr(b.limit - b.used)} left`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="card">
          <h2 className="h2 mb-3">Goals</h2>
          {goals.length === 0
            ? empty("No goals yet.")
            : (
              <ul className="space-y-3 text-sm">
                {goals.map((g) => (
                  <li key={g.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{g.name}</span>
                      <span className="tabular-nums">
                        {inr(g.have)} <span className="text-muted">of {inr(g.target)}</span>
                      </span>
                    </div>
                    {bar(g.have / g.target, "#2a78d6")}
                    <div className="mt-1 text-xs text-muted">
                      {g.have >= g.target
                        ? "Reached"
                        : `${Math.round((g.have / g.target) * 100)}% · ${inr(g.target - g.have)} to go`}
                      {g.deadline && g.have < g.target && g.perMonth !== null &&
                        ` · ${inr(g.perMonth)}/month to hit ${g.deadline.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
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
        <div className="card">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="h2">Fixed every month</h2>
            <span className="font-medium tabular-nums">{inr(fixedTotal)}</span>
          </div>
          {fixed.length === 0
            ? empty("No fixed payments yet.")
            : (
              <>
                <ul className="divide-rows -mx-4 text-sm">
                  {fixed.map((f) => (
                    <li key={f.id} className="flex gap-3 px-4 py-2">
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="tabular-nums">{inr(f.amount)}</span>
                    </li>
                  ))}
                </ul>
                {income > 0 && (
                  <p className="hint mt-3">
                    {inr(income - fixedTotal)} of this month&apos;s income is left after fixed payments.
                  </p>
                )}
              </>
            )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">Top money in</h2>
          {moneyIn.length ? (
            <ul className="divide-rows -mx-4 text-sm">
              {moneyIn.map((m) => (
                <li key={m.name} className="row px-4">
                  <span className="min-w-0 flex-1 truncate" title={m.name}>
                    {m.name}
                  </span>
                  <span className="pill shrink-0">{m.category}</span>
                  {m.count > 1 && <span className="hint shrink-0">{m.count}×</span>}
                  <span className="amount-pos w-24 shrink-0 text-right tabular-nums">{inr(m.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing came in.</p>
          )}
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
