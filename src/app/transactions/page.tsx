import { db } from "@/lib/db";
import { inr, monthKey } from "@/lib/format";
import Row from "./Row";

type SP = { month?: string; account?: string; category?: string; q?: string };

function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)) };
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : monthKey(new Date());
  const { start, end } = monthRange(month);
  const account = sp.account ?? "";
  const category = sp.category ?? "";
  const q = sp.q ?? "";

  const where = {
    date: { gte: start, lt: end },
    ...(account ? { account: { code: account } } : {}),
    ...(category === "none" ? { categoryId: null } : category ? { categoryId: Number(category) } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [txns, accounts, categories] = await Promise.all([
    db.transaction.findMany({
      where,
      include: { account: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 500,
    }),
    db.account.findMany({ orderBy: { code: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const out = txns.filter((t) => Number(t.amount) < 0).reduce((s, t) => s - Number(t.amount), 0);
  const inn = txns.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const uncat = txns.filter((t) => t.categoryId === null).length;
  const monthName = start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Transactions</h1>
        <p className="muted mt-1">{monthName}</p>
      </div>

      <form method="get" className="card grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <input type="month" name="month" defaultValue={month} className="input sm:w-40" />
        <select name="account" defaultValue={account} className="select sm:w-36">
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.code}>
              {a.code}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={category} className="select sm:w-44">
          <option value="">All categories</option>
          <option value="none">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Search merchant" className="input sm:flex-1" />
        <button className="btn-primary col-span-2 sm:col-span-1 sm:w-auto">Apply</button>
      </form>

      {uncat > 0 && category !== "none" && (
        <a
          href={`/transactions?month=${month}&category=none`}
          className="block rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          {uncat} uncategorised in this view · tap to show only those
        </a>
      )}

      {txns.length === 0 ? (
        <p className="card muted">
          No transactions match.{" "}
          <a href="/upload" className="underline">
            Upload a statement
          </a>
          .
        </p>
      ) : (
        <div className="card-tight divide-rows overflow-hidden">
          {txns.map((t) => (
            <Row
              key={t.id}
              id={t.id}
              date={t.date.toISOString().slice(0, 10)}
              description={t.description}
              accountCode={t.account.code}
              amount={Number(t.amount)}
              categoryId={t.categoryId}
              categories={categories}
            />
          ))}
        </div>
      )}

      <p className="muted tabular-nums">
        {txns.length} txns{txns.length === 500 ? " (first 500)" : ""} · out <span className="amount-neg">{inr(out)}</span> · in{" "}
        <span className="amount-pos">{inr(inn)}</span>
      </p>
    </div>
  );
}
