/** Axis Bank credit card statement (Flipkart Axis, Neo, ...). */
import type { Reader, StmtRow } from "./index";
import type { Page, Word } from "./pdf";

const DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const AMT = /^[\d,]+\.\d\d$/;
const N = "([\\d,]+\\.\\d\\d)";
// Previous Balance - Payments - Credits + Purchase + Cash Advance + Other Debit&Charges = Total Payment Due
const SUMMARY = new RegExp(`${N} (Dr|Cr) ${N} ${N} ${N} ${N} ${N} ${N} (Dr|Cr)`);

const num = (s: string) => Number(s.replace(/,/g, ""));

/** Words grouped into visual lines (top within 3pt), left to right — same as the Python reader. */
function lines(words: Word[]): Word[][] {
  const out: Word[][] = [];
  for (const w of [...words].sort((a, b) => Math.round(a.top) - Math.round(b.top) || a.x0 - b.x0)) {
    const line = out.at(-1);
    if (line && Math.abs(line[0].top - w.top) < 3) line.push(w);
    else out.push([w]);
  }
  return out.map((l) => l.sort((a, b) => a.x0 - b.x0));
}

const join = (ws: Word[]) => ws.map((w) => w.text).join(" ");

function parse(pages: Page[]): StmtRow[] {
  const rows: StmtRow[] = [];
  let catX: number | null = null;
  let done = false;
  for (const page of pages) {
    for (const line of lines(page.words)) {
      const text = join(line);
      if (text.includes("End of Statement")) {
        done = true;
        break;
      }
      if (line[0].text === "DATE" && text.includes("MERCHANT")) {
        // category values sit left of their centred header: split midway DETAILS-end / MERCHANT-start
        const det = line.find((w) => w.text === "DETAILS");
        const mer = line.find((w) => w.text === "MERCHANT")!;
        if (!det) throw new Error("Axis: DETAILS header not found");
        catX = (det.x1 + mer.x0) / 2;
        continue;
      }
      if (catX === null || !DATE.test(line[0].text)) continue;
      // first "<amount> Dr|Cr" pair is the txn amount; a second one (Flipkart) is cashback earned
      let i = 1;
      while (i < line.length - 1 && !(AMT.test(line[i].text) && ["Dr", "Cr"].includes(line[i + 1].text))) i++;
      if (i >= line.length - 1) throw new Error(`Axis: no amount on line "${text}"`);
      const amount = num(line[i].text) * (line[i + 1].text === "Dr" ? -1 : 1);
      const description = join(line.slice(1, i).filter((w) => w.x0 < catX!));
      const [d, m, y] = line[0].text.split("/");
      rows.push({ date: `${y}-${m}-${d}`, description, amount });
    }
    if (done) break;
  }
  if (!done || catX === null) throw new Error("Axis: transaction table not found");

  const g = lines(pages[0].words).map(join).join("\n").match(SUMMARY);
  if (!g) throw new Error("Axis: account summary line not found");
  const prev = num(g[1]) * (g[2] === "Dr" ? -1 : 1);
  const credits = num(g[3]) + num(g[4]);
  const debits = num(g[5]) + num(g[6]) + num(g[7]);
  const due = num(g[8]) * (g[9] === "Dr" ? -1 : 1);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const gotCr = r2(rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0));
  const gotDr = r2(-rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0));
  if (Math.abs(gotCr - credits) > 0.01 || Math.abs(gotDr - debits) > 0.01)
    throw new Error(`Axis: rows Cr ${gotCr} / Dr ${gotDr} != summary Cr ${credits} / Dr ${debits}`);
  if (Math.abs(prev + credits - debits - due) > 0.01)
    throw new Error(`Axis: summary does not add up (${prev} + ${credits} - ${debits} != ${due})`);
  return rows;
}

export const axis: Reader = {
  detect: (text) => text.includes("Credit Card Statement") && text.includes("Axis Bank"),
  parse,
};
