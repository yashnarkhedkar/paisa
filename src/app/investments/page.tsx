import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { deleteHolding, importZerodha, upsertHolding } from "./actions";

const KINDS = ["STOCK", "MF", "GOLD", "FD"] as const;
const pct = (pl: number, inv: number) => (inv ? ((pl / inv) * 100).toFixed(1) + "%" : "—");
const plCls = (n: number) => (n >= 0 ? "amount-pos" : "amount-neg");
const td = "px-3 py-2 whitespace-nowrap";
const num = `${td} text-right tabular-nums`;

export default async function Investments({ searchParams }: { searchParams: Promise<{ imported?: string }> }) {
  const { imported } = await searchParams;
  const rows = (await db.holding.findMany({ orderBy: [{ kind: "asc" }, { symbol: "asc" }] })).map((h) => {
    const qty = Number(h.qty), avg = Number(h.avgPrice);
    const cur = h.currentPrice == null ? avg : Number(h.currentPrice);
    return { id: h.id, kind: h.kind, symbol: h.symbol, note: h.note, qty, avg, cur, invested: qty * avg, value: qty * cur };
  });
  const sum = (xs: typeof rows) => xs.reduce((a, r) => ({ inv: a.inv + r.invested, val: a.val + r.value }), { inv: 0, val: 0 });
  const total = sum(rows);
  const totalPl = total.val - total.inv;

  return (
    <div className="space-y-6">
      <h1 className="h1">Investments</h1>
      {total.inv === 0 && <p className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Nothing here yet. Add a holding below, or import your Zerodha holdings CSV (Console → Holdings → Download).</p>}
      {imported && <p className="rounded-[14px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{imported} upserted</p>}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card"><div className="stat-label">Invested</div><div className="stat-value">{inr(total.inv)}</div></div>
        <div className="card"><div className="stat-label">Current</div><div className="stat-value">{inr(total.val)}</div></div>
        <div className="card">
          <div className="stat-label">P&L</div>
          <div className={`stat-value ${plCls(totalPl)}`}>{inr(totalPl)} <span className="text-sm font-medium">({pct(totalPl, total.inv)})</span></div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {KINDS.map((k) => {
            const g = rows.filter((r) => r.kind === k);
            if (!g.length) return null;
            const t = sum(g), pl = t.val - t.inv;
            return (
              <section key={k} className="space-y-2">
                <h2 className="h2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold text-ink">{k}</span>
                  <span className={`text-xs ${plCls(pl)}`}>{inr(t.inv)} → {inr(t.val)} ({inr(pl)}, {pct(pl, t.inv)})</span>
                </h2>
                <div className="card-tight overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted">
                      <tr className="border-b border-line">
                        {["Symbol", "Qty", "Avg", "Cur", "Invested", "Value", "P&L", "%", ""].map((h, i) => (
                          <th key={h || "x"} className={`${td} font-medium ${i > 0 && i < 8 ? "text-right" : ""}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-rows">
                      {g.map((r) => {
                        const p = r.value - r.invested;
                        return (
                          <tr key={r.id}>
                            <td className={`${td} font-medium`} title={r.note ?? ""}>{r.symbol}</td>
                            <td className={num}>{r.qty.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                            <td className={num}>{inr(r.avg)}</td>
                            <td className={num}>{inr(r.cur)}</td>
                            <td className={num}>{inr(r.invested)}</td>
                            <td className={num}>{inr(r.value)}</td>
                            <td className={`${num} ${plCls(p)}`}>{inr(p)}</td>
                            <td className={`${num} ${plCls(p)}`}>{pct(p, r.invested)}</td>
                            <td className={`${td} text-right`}>
                              <form action={deleteHolding}>
                                <input type="hidden" name="id" value={r.id} />
                                <button className="btn-danger btn-sm" aria-label="Delete">×</button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          <form action={upsertHolding} className="card space-y-3">
            <h2 className="h2">Add / edit holding</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select name="kind" className="select">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
              <input name="symbol" placeholder="Symbol" required className="input" />
              <input name="qty" type="number" step="any" placeholder="Qty" required className="input" />
              <input name="avgPrice" type="number" step="any" placeholder="Avg price" required className="input" />
              <input name="currentPrice" type="number" step="any" placeholder="Current price (optional)" className="input" />
              <input name="note" placeholder="Note" className="input" />
            </div>
            <p className="hint">GOLD: qty = grams, avg = ₹/g. FD: qty = 1, avg = principal, current = current value. Same kind+symbol overwrites.</p>
            <button className="btn-primary w-full">Save</button>
          </form>

          <form action={importZerodha} className="card space-y-3">
            <h2 className="h2">Import Zerodha holdings CSV</h2>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-bg"
            />
            <button className="btn w-full">Import</button>
          </form>
        </div>
      </div>
    </div>
  );
}
