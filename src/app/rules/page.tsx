import { db } from "@/lib/db";
import { addRule, deleteRule } from "./actions";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const [rules, cats] = await Promise.all([
    db.rule.findMany({ include: { category: true }, orderBy: { keyword: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
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
          </form>
        </div>
      </div>
    </div>
  );
}
