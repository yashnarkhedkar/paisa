import { db } from "@/lib/db";
import { inr, monthKey } from "@/lib/format";
import { merchantKeyword } from "@/lib/categorise";
import CategoryPicker from "./CategoryPicker";
import Row, { rupees } from "./Row";
import SelectAll from "./SelectAll";
import { bulkSetCategory } from "./actions";

type SP = { month?: string; account?: string; category?: string; q?: string; sort?: string; group?: string | string[] };

const SORTS = {
  new: { label: "Newest first", orderBy: [{ date: "desc" }, { id: "desc" }] },
  old: { label: "Oldest first", orderBy: [{ date: "asc" }, { id: "asc" }] },
  spend: { label: "Biggest spend", orderBy: [{ amount: "asc" }] },
  credit: { label: "Biggest credit", orderBy: [{ amount: "desc" }] },
  name: { label: "A–Z", orderBy: [{ description: "asc" }] },
} as const;
type Sort = keyof typeof SORTS;

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
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "spend";
  // on by default: the hidden "0" is sent when the box is unticked, the box adds "1" when ticked
  const g = [sp.group ?? []].flat();
  const grouped = g.includes("1") || !g.includes("0");

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
      orderBy: [...SORTS[sort].orderBy],
      take: 500,
    }),
    db.account.findMany({ orderBy: { code: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const out = txns.filter((t) => Number(t.amount) < 0).reduce((s, t) => s - Number(t.amount), 0);
  const inn = txns.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const uncat = txns.filter((t) => t.categoryId === null).length;
  // "similar" = same merchantKeyword (UPI id, or cleaned merchant name). Rows already arrive in the chosen sort,
  // so groups keep the order of their first row; for amount sorts, order groups by their total instead.
  const groups = new Map<string, typeof txns>();
  for (const t of txns) {
    const k = merchantKeyword(t.description) || t.description.trim().toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const total = (g: typeof txns) => g.reduce((s, t) => s + Number(t.amount), 0);
  const groupList = [...groups].sort(([, a], [, b]) =>
    sort === "spend" ? total(a) - total(b) : sort === "credit" ? total(b) - total(a) : 0,
  );

  const row = (t: (typeof txns)[number]) => (
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
  );

  const monthName = start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Transactions</h1>
        <p className="muted mt-1">{monthName}</p>
      </div>

      <form method="get" className="card grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
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
        <input type="search" name="q" defaultValue={q} placeholder="Search merchant" className="input sm:min-w-48 sm:flex-1" />
        <select name="sort" defaultValue={sort} className="select sm:w-40" aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="hidden" name="group" value="0" />
          <input type="checkbox" name="group" value="1" defaultChecked={grouped} />
          Group similar
        </label>
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
        <>
        <form id="bulk" action={bulkSetCategory} className="card flex flex-wrap items-center gap-2 text-sm">
          <span className="muted">Ticked rows:</span>
          <select name="categoryId" required className="select w-auto py-1 text-xs" aria-label="Category for ticked rows">
            <option value="">Pick category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn-primary btn-sm">Set category</button>
          <SelectAll />
        </form>
        <div className="card-tight divide-rows overflow-hidden">
          {!grouped
            ? txns.map(row)
            : groupList.map(([key, g]) =>
                g.length === 1 ? (
                  row(g[0])
                ) : (
                  <div key={key} className="px-4 py-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <input
                        type="checkbox"
                        form="bulk"
                        name="ids"
                        value={g.map((t) => t.id).join(",")}
                        aria-label="Select group"
                        className="shrink-0 self-center"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {key} <span className="pill ml-1">{g.length}×</span>
                      </span>
                      <span className={`shrink-0 font-medium ${total(g) < 0 ? "amount-neg" : "amount-pos"}`}>{rupees(total(g))}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <details className="min-w-0 flex-1">
                        <summary className="cursor-pointer select-none">show {g.length}</summary>
                        <div className="divide-rows -mx-4 mt-2 border-t border-line">{g.map(row)}</div>
                      </details>
                      <CategoryPicker
                        ids={g.map((t) => t.id)}
                        // one category for the group only if every row already shares it
                        categoryId={g.every((t) => t.categoryId === g[0].categoryId) ? g[0].categoryId : null}
                        keyword={merchantKeyword(g[0].description)}
                        categories={categories}
                        placeholder="Set all"
                      />
                    </div>
                  </div>
                ),
              )}
        </div>
        </>
      )}

      <p className="muted tabular-nums">
        {txns.length} txns{txns.length === 500 ? " (first 500)" : ""} · out <span className="amount-neg">{inr(out)}</span> · in{" "}
        <span className="amount-pos">{inr(inn)}</span>
      </p>
    </div>
  );
}
