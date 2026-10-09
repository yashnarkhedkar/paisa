import type { Reader, StmtRow } from "./index";
import type { Word } from "./pdf";

/** ICICI credit card. Port of scripts/statements/icici.py: table columns cut at header x-positions,
 *  a row starts at a dd/mm/yyyy date in the Date column, wrapped description lines (<10pt) appended, "CR" = credit. */
const DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const MONEY = /[\d,]+\.\d{2}$/;
const num = (s: string) => parseFloat(s.replace(/[^\d.]/g, ""));

function summary(words: Word[]) {
  const get = (label: string) => {
    const lw = words.find((w) => w.text === label);
    if (!lw) throw new Error(`ICICI: summary label "${label}" not found`);
    const val = words
      .filter((w) => /^\d+$/.test(w.text.replace(/^[`₹]+/, "").replace(/[,.]/g, "")) && MONEY.test(w.text)
        && w.top - lw.top > 0 && w.top - lw.top < 25 && Math.abs(w.x0 - lw.x0) < 40)
      .sort((a, b) => a.top - b.top)[0];
    if (!val) throw new Error(`ICICI: summary value for "${label}" not found`);
    return num(val.text);
  };
  return { prev: get("Previous"), purch: get("Purchases"), cash: get("Advances"), pay: get("Payments"), due: get("Total") };
}

function rows(words: Word[]): StmtRow[] {
  const ser = words.find((w) => w.text === "SerNo.");
  if (!ser) return [];
  const keys = ["Date", "SerNo.", "Transaction", "Reward", "Amount"];
  const hdr: Record<string, Word> = {};
  for (const w of words) if (Math.abs(w.top - ser.top) < 3 && keys.includes(w.text)) hdr[w.text] = w;
  if (Object.keys(hdr).length < 5) throw new Error("ICICI: transaction table header not recognised");
  const [d0, s0, t0, r0, a0] = keys.map((k) => hdr[k].x0);
  const body = words.filter((w) => w.top > hdr.Date.top + 12 && w.x0 >= d0 - 5)
    .sort((a, b) => Math.round(a.top) - Math.round(b.top) || a.x0 - b.x0);
  type Cur = { top: number; last: number; date: string; ref?: string; desc: string[]; amt: string[] };
  const out: Cur[] = [];
  let cur: Cur | undefined;
  for (const w of body) {
    const { x0: x, text: t } = w;
    if (Math.abs(x - d0) < 5 && DATE.test(t)) out.push((cur = { top: w.top, last: w.top, date: t, desc: [], amt: [] }));
    else if (!cur || w.top - cur.last > 10) continue; // card-number line, footer, etc.
    else if (Math.abs(w.top - cur.top) < 3 && s0 - 15 < x && x < t0 - 5) cur.ref = t;
    else if (t0 - 3 <= x && x < r0 - 3) { cur.desc.push(t); cur.last = w.top; }
    else if (Math.abs(w.top - cur.top) < 3 && w.x1 >= a0) cur.amt.push(t);
  }
  return out.map((r) => {
    const amt = r.amt.filter((a) => /^[\d,]+\.\d{2}$/.test(a));
    if (amt.length !== 1) throw new Error(`ICICI: cannot read amount for ${r.date} ${r.ref}: ${r.amt.join(" ")}`);
    const v = num(amt[0]);
    const [d, m, y] = r.date.split("/");
    return { date: `${y}-${m}-${d}`, description: r.desc.join(" "), amount: r.amt.includes("CR") ? v : -v, ref: r.ref };
  });
}

export const icici: Reader = {
  detect: (text) => text.includes("CREDIT CARD STATEMENT") && text.toUpperCase().includes("ICICI") && text.includes("SerNo."),
  parse(pages) {
    const s = summary(pages[0].words);
    const all = pages.flatMap((p) => rows(p.words));
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const debit = r2(-all.reduce((t, r) => t + (r.amount < 0 ? r.amount : 0), 0));
    const credit = r2(all.reduce((t, r) => t + (r.amount > 0 ? r.amount : 0), 0));
    const checks: [string, number, number][] = [
      ["debits vs purchases+cash", debit, s.purch + s.cash],
      ["credits vs payments", credit, s.pay],
      ["prev+spend-pay vs total due", s.prev + s.purch + s.cash - s.pay, s.due],
    ];
    for (const [name, got, want] of checks)
      if (Math.abs(got - want) > 0.01) throw new Error(`ICICI: ${name} mismatch: ${got.toFixed(2)} != ${want.toFixed(2)}`);
    return all;
  },
};
