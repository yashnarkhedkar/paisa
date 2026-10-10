import { db } from "@/lib/db";
import { LOCKED } from "@/lib/categorise";
import { inr } from "@/lib/format";
import { addFixedPayment, addGoal, deleteFixedPayment, deleteGoal, saveBudget, saveGoal } from "./actions";

export const dynamic = "force-dynamic";

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function PlanPage() {
  const [goals, cats, fixed] = await Promise.all([
    db.goal.findMany({ include: { category: true }, orderBy: { createdAt: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.fixedPayment.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const savingCats = cats.filter((c) => !c.isSpending && !LOCKED.includes(c.name));
  const spendingCats = cats.filter((c) => c.isSpending);
  const fixedTotal = fixed.reduce((s, f) => s + Number(f.amount), 0);
  const today = ymd(new Date());

  const catSelect = (value: number | null) => (
    <select name="categoryId" defaultValue={value ?? ""} className="select w-auto">
      <option value="">no linked category</option>
      {savingCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="h1">Plan</h1>
        <p className="hint">Goals you&apos;re saving for, monthly budgets per spending category, and fixed payments that leave every month.</p>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="h2">Goals</h2>
          <p className="hint">
            Progress = already saved + net money put into the linked category since the counting-from date. Link a non-spending
            category (e.g. Savings) so transfers into it count automatically.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="card-tight divide-rows order-2 lg:order-1">
            {goals.length === 0 && <li className="row muted">No goals yet.</li>}
            {goals.map((g) => (
              <li key={g.id} className="row flex-wrap">
                <form action={saveGoal} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <input name="name" defaultValue={g.name} required aria-label="Name" className="input w-auto min-w-0 flex-1" />
                  <label className="flex items-center gap-1.5 text-sm">
                    target
                    <input name="target" type="number" min="1" step="any" defaultValue={Number(g.target)} required className="input w-28" />
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    already saved
                    <input name="base" type="number" min="0" step="any" defaultValue={Number(g.base)} className="input w-28" />
                  </label>
                  {catSelect(g.categoryId)}
                  <label className="flex items-center gap-1.5 text-sm">
                    deadline
                    <input name="deadline" type="date" defaultValue={ymd(g.deadline)} className="input w-auto" />
                  </label>
                  <span className="hint" title="money saved before this date is in 'already saved'">
                    counting from {ymd(g.countFrom)}
                  </span>
                  <button className="btn btn-sm">Save</button>
                </form>
                <form action={deleteGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="btn-danger btn-sm">Delete</button>
                </form>
              </li>
            ))}
          </ul>

          <div className="order-1 lg:order-2">
            <form action={addGoal} className="card space-y-3 lg:sticky lg:top-6">
              <h2 className="h2">Add goal</h2>
              <input name="name" placeholder="e.g. Marriage fund" required className="input" />
              <input name="target" type="number" min="1" step="any" placeholder="target ₹" required className="input" />
              <label className="block space-y-1 text-sm">
                <span>already saved</span>
                <input name="base" type="number" min="0" step="any" defaultValue={0} className="input" />
              </label>
              {catSelect(null)}
              <label className="block space-y-1 text-sm">
                <span>deadline (optional)</span>
                <input name="deadline" type="date" className="input" />
              </label>
              <p className="hint">Counting from {today} — money saved before this date is in &quot;already saved&quot;.</p>
              <button className="btn-primary w-full">Add</button>
            </form>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="h2">Budgets</h2>
          <p className="hint">Monthly limit per spending category. Leave empty for no budget.</p>
        </div>
        <ul className="card-tight divide-rows">
          {spendingCats.length === 0 && <li className="row muted">No spending categories.</li>}
          {spendingCats.map((c) => (
            <li key={c.id} className="row">
              <form action={saveBudget} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                <input
                  name="budget"
                  type="number"
                  min="1"
                  step="any"
                  defaultValue={c.budget ? Number(c.budget) : ""}
                  placeholder="no budget"
                  aria-label={`${c.name} monthly budget`}
                  className="input w-32"
                />
                <button className="btn btn-sm">Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="h2">Fixed monthly payments</h2>
          <p className="hint">Rent, insurance, SIPs — money committed every month.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="card-tight divide-rows order-2 lg:order-1">
            {fixed.length === 0 && <li className="row muted">No fixed payments yet.</li>}
            {fixed.map((f) => (
              <li key={f.id} className="row">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                <span className="tabular-nums">{inr(f.amount)}</span>
                <form action={deleteFixedPayment}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="btn-danger btn-sm">Delete</button>
                </form>
              </li>
            ))}
            {fixed.length > 0 && (
              <li className="row">
                <span className="flex-1 text-sm font-semibold">Total / month</span>
                <span className="pill tabular-nums">{inr(fixedTotal)}</span>
              </li>
            )}
          </ul>
          <div className="order-1 lg:order-2">
            <form action={addFixedPayment} className="card space-y-3 lg:sticky lg:top-6">
              <h2 className="h2">Add fixed payment</h2>
              <input name="name" placeholder="e.g. HDFC policy" required className="input" />
              <input name="amount" type="number" min="1" step="any" placeholder="amount ₹ / month" required className="input" />
              <button className="btn-primary w-full">Add</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
