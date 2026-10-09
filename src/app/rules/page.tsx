import { db } from "@/lib/db";
import { LOCKED } from "@/lib/categorise";
import { addRule, deleteCategory, deleteRule, reapplyRules, saveCategory } from "./actions";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const [rules, cats] = await Promise.all([
    db.rule.findMany({ include: { category: true }, orderBy: { keyword: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { transactions: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="h1">Rules</h1>
        <p className="hint">A rule matches when its keyword appears anywhere in a transaction description. First match wins. Keep keywords specific: &quot;ola cabs&quot;, not &quot;ola&quot;.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ul className="card-tight divide-rows order-2 lg:order-1">
          {rules.length === 0 && <li className="row muted">No rules yet.</li>}
          {rules.map((r) => (
            <li key={r.id} className="row">
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">{r.keyword}</span>
              <span className="pill">{r.category.name}</span>
              <form action={deleteRule}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn-danger btn-sm">Delete</button>
              </form>
            </li>
          ))}
        </ul>

        <div className="order-1 lg:order-2">
          <form action={addRule} className="card space-y-3 lg:sticky lg:top-6">
            <h2 className="h2">Add rule</h2>
            <input name="keyword" placeholder="keyword e.g. swiggy" required className="input" />
            <select name="categoryId" required className="select">
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-primary w-full">Add</button>
            <p className="hint">Also tags matching uncategorised transactions already imported.</p>
          </form>
          <form action={reapplyRules} className="mt-3">
            <button className="btn w-full">Re-apply all rules to uncategorised</button>
          </form>
        </div>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="h2">Categories</h2>
          <p className="hint">
            Untick &quot;spending&quot; for money that isn&apos;t an expense (savings, transfers). Income, Transfer and Reimbursement drive
            the dashboard maths, so their names are fixed. Deleting a category leaves its transactions uncategorised and removes its rules.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="card-tight divide-rows order-2 lg:order-1">
            {cats.map((c) => {
              const locked = LOCKED.includes(c.name);
              return (
                <li key={c.id} className="row flex-wrap">
                  <form action={saveCategory} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" defaultValue={c.name} readOnly={locked} required className="input w-auto min-w-0 flex-1" />
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="isSpending" defaultChecked={c.isSpending} />
                      spending
                    </label>
                    <span className="hint tabular-nums">{c._count.transactions} txns</span>
                    <button className="btn btn-sm">Save</button>
                  </form>
                  {!locked && (
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-danger btn-sm">Delete</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="order-1 lg:order-2">
            <form action={saveCategory} className="card space-y-3 lg:sticky lg:top-6">
              <h2 className="h2">Add category</h2>
              <input name="name" placeholder="e.g. Rent" required className="input" />
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="isSpending" defaultChecked />
                counts as spending
              </label>
              <button className="btn-primary w-full">Add</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
