import { db } from "@/lib/db";
import { payer } from "@/lib/categorise";
import { inr, monthKey } from "@/lib/format";
import { CardMonthly, CategoryBar } from "../Charts";

export const dynamic = "force-dynamic";

// Charges the bank adds on top of what you bought: worth seeing on their own.
const FEE = /surcharge|gst|finance charge|interest|late|annual fee|overlimit/i;
const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
const short = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
};

/**
 * Credit cards, all time. On a card account money out = spend; money in = bill paid (Transfer),
 * cashback (Reimbursement or "cashback" in the text) or a refund (anything else).
 */
export default async function CardsPage() {
  const cards = await db.account.findMany({
    where: { kind: "CARD" },
    orderBy: { code: "asc" },
    include: { transactions: { include: { category: true }, orderBy: { date: "desc" } } },
  });
  if (!cards.length) return <p className="card muted">No card accounts yet. Add one on Accounts with kind CARD.</p>;

  const stats = cards.map((c) => {
    const tx = c.transactions.map((t) => ({ ...t, amount: Number(t.amount) }));
    const spends = tx.filter((t) => t.amount < 0);
    const credits = tx.filter((t) => t.amount > 0);
    const sum = (xs: typeof tx) => xs.reduce((s, t) => s + Math.abs(t.amount), 0);
    const bills = credits.filter((t) => t.category?.name === "Transfer");
    const cashback = credits.filter((t) => !bills.includes(t) && (t.category?.name === "Reimbursement" || /cashback/i.test(t.description)));
    const refunds = credits.filter((t) => !bills.includes(t) && !cashback.includes(t));
    const fees = spends.filter((t) => FEE.test(t.description));
    const activeMonths = new Set(spends.map((t) => monthKey(t.date))).size || 1;

    const byCat = new Map<string, number>();
    for (const t of spends) {
      const k = t.category?.name ?? "Uncategorised";
      byCat.set(k, (byCat.get(k) ?? 0) - t.amount);
    }
    const merch = new Map<string, { total: number; count: number }>();
    for (const t of spends) {
      const k = payer(t.description);
      const m = merch.get(k) ?? { total: 0, count: 0 };
      m.total -= t.amount;
      m.count++;
      merch.set(k, m);
    }

    return {
      code: c.code,
      name: c.name,
      spends,
      bills,
      fees,
      spent: sum(spends),
      paid: sum(bills),
      cashback: sum(cashback),
      refunds: sum(refunds),
      feeTotal: sum(fees),
      perMonth: sum(spends) / activeMonths,
      byCat: [...byCat].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      top: [...merch].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 5),
    };
  });

  const months = [...new Set(stats.flatMap((s) => [...s.spends, ...s.bills].map((t) => monthKey(t.date))))].sort();
  const spentIn = (code: string, m: string) =>
    stats.find((s) => s.code === code)!.spends.filter((t) => monthKey(t.date) === m).reduce((x, t) => x - t.amount, 0);
  const monthly = months.map((m) => ({ month: short(m), ...Object.fromEntries(stats.map((s) => [s.code, spentIn(s.code, m)])) }));
  const paidIn = (m: string) => stats.reduce((x, s) => x + s.bills.filter((t) => monthKey(t.date) === m).reduce((y, t) => y + t.amount, 0), 0);
  const allSpentIn = (m: string) => stats.reduce((x, s) => x + spentIn(s.code, m), 0);

  const totals: [string, number][] = [
    ["Spent on cards", stats.reduce((x, s) => x + s.spent, 0)],
    ["Bills paid", stats.reduce((x, s) => x + s.paid, 0)],
    ["Cashback earned", stats.reduce((x, s) => x + s.cashback, 0)],
    ["Fees & charges", stats.reduce((x, s) => x + s.feeTotal, 0)],
  ];
  const recentBills = stats
    .flatMap((s) => s.bills.map((t) => ({ ...t, card: s.code })))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12);
  const allFees = stats.flatMap((s) => s.fees.map((t) => ({ ...t, card: s.code }))).sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Credit cards</h1>
        <p className="muted mt-1">All imported statements{months.length ? `, ${short(months[0])} to ${short(months.at(-1)!)}` : ""}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.map(([label, v]) => (
          <div key={label} className="card">
            <p className="hint">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{inr(v)}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="h2 mb-3">Spend per month</h2>
        <CardMonthly data={monthly} cards={stats.map((s) => s.code)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.code} className="card space-y-4">
            <div>
              <h2 className="h2">{s.name}</h2>
              <p className="hint">{s.code}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="muted">Spent</dt>
              <dd className="text-right tabular-nums">
                {inr(s.spent)} <span className="hint">· {s.spends.length} txns</span>
              </dd>
              <dt className="muted">Avg / month</dt>
              <dd className="text-right tabular-nums">{inr(s.perMonth)}</dd>
              <dt className="muted">Bills paid</dt>
              <dd className="text-right tabular-nums">{inr(s.paid)}</dd>
              <dt className="muted">Cashback</dt>
              <dd className="text-right tabular-nums">
                {inr(s.cashback)}
                {s.spent > 0 && <span className="hint"> · {((s.cashback / s.spent) * 100).toFixed(1)}%</span>}
              </dd>
              {s.refunds > 0 && (
                <>
                  <dt className="muted">Refunds</dt>
                  <dd className="text-right tabular-nums">{inr(s.refunds)}</dd>
                </>
              )}
              <dt className="muted">Fees & charges</dt>
              <dd className={`text-right tabular-nums ${s.feeTotal > 0 ? "text-neg" : ""}`}>{inr(s.feeTotal)}</dd>
              <dt className="muted">Last bill paid</dt>
              <dd className="text-right tabular-nums">{s.bills[0] ? `${inr(s.bills[0].amount)} · ${day(s.bills[0].date)}` : "—"}</dd>
            </dl>
            {s.byCat.length > 0 && (
              <div>
                <h3 className="hint mb-1">Where it went</h3>
                <CategoryBar data={s.byCat.slice(0, 6)} />
              </div>
            )}
            {s.top.length > 0 && (
              <div>
                <h3 className="hint mb-1">Top merchants</h3>
                <ul className="divide-rows text-sm">
                  {s.top.map((m) => (
                    <li key={m.name} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate" title={m.name}>
                        {m.name}
                      </span>
                      {m.count > 1 && <span className="hint">{m.count}×</span>}
                      <span className="tabular-nums">{inr(m.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">Spent vs paid, by month</h2>
          <ul className="divide-rows text-sm">
            {[...months].reverse().map((m) => (
              <li key={m} className="flex items-center gap-2 py-1.5">
                <span className="w-16 shrink-0">{short(m)}</span>
                <span className="amount-neg flex-1 text-right tabular-nums">{inr(allSpentIn(m))} spent</span>
                <span className="amount-pos w-32 text-right tabular-nums">{inr(paidIn(m))} paid</span>
              </li>
            ))}
          </ul>
          <p className="hint mt-2">A bill is paid the month after you spend, so the columns lag by a month.</p>
        </div>

        <div className="card">
          <h2 className="h2 mb-3">Recent bill payments</h2>
          {recentBills.length ? (
            <ul className="divide-rows text-sm">
              {recentBills.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1.5">
                  <span className="w-20 shrink-0 tabular-nums">{day(t.date)}</span>
                  <span className="pill shrink-0">{t.card}</span>
                  <span className="amount-pos flex-1 text-right tabular-nums">{inr(t.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No bill payments found. Tag them as Transfer.</p>
          )}
        </div>
      </div>

      {allFees.length > 0 && (
        <div className="card">
          <h2 className="h2 mb-1">Fees & charges</h2>
          <p className="hint mb-3">
            Paid to the bank on top of purchases. Fuel surcharge and its GST are normal. Interest or a late fee means a bill was paid late or only partly.
          </p>
          <ul className="divide-rows text-sm">
            {allFees.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5">
                <span className="w-20 shrink-0 tabular-nums">{day(t.date)}</span>
                <span className="pill shrink-0">{t.card}</span>
                <span className="min-w-0 flex-1 truncate">{t.description}</span>
                <span className="amount-neg tabular-nums">{inr(-t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
