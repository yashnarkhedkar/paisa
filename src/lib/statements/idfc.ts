import type { Reader, StmtRow } from "./index";
import { lines, type Page, type Word } from "./pdf";

/**
 * IDFC FIRST Bank savings statement (consolidated statement PDF).
 * The grid is ruled, but we only have words: column edges are rebuilt from the header (each header is
 * centred in its column), rows from the date lines. Narrations wrap symmetrically above and below the
 * date line, so a row takes as many lines below its date as it had above it.
 */
const DATE = /^(\d\d) (\w{3}) (\d\d) \d\d:\d\d$/;
const SUMMARY = /([\d,]+\.\d\d) (CR|DR) (\d+) (\d+) ([\d,]+\.\d\d) ([\d,]+\.\d\d) ([\d,]+\.\d\d) (CR|DR)/;
const REF = /^(?:UPI\/(?:DR|CR)|NEFT|IMPS|RTGS)\/([A-Z0-9]+)\//;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HEADS = ["Date", "Value", "Transaction", "Ref/Cheque", "Withdrawals", "Deposits", "Balance"];

const num = (s: string) => Number(s.replace(/,/g, ""));
const bal = (v: string, side: string) => num(v) * (side === "DR" ? -1 : 1);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Join a cell's visual lines; a wrap right at a separator is a mid-token break (".../" + "BARB/..."): no space. */
const join = (ls: Word[][]) =>
  ls.reduce((out, ln) => {
    const t = ln.map((w) => w.text).join(" ");
    return !out || /[/@]$/.test(out) || /^[/@]/.test(t) ? out + t : `${out} ${t}`;
  }, "");

function pageRows(page: Page, pn: number): string[][] {
  const ws = page.words;
  const hi = ws.findIndex((w, i) => w.text === "Transaction" && ws[i + 1]?.text === "Details");
  if (hi < 0) return [];
  const top = ws[hi].top;
  // header line, left to right: "Date and Time | Value Date | Transaction Details | Ref/Cheque | ..."
  const hdr = ws.filter((w) => Math.abs(w.top - top) < 2).sort((a, b) => a.x0 - b.x0);
  const starts = HEADS.map((h) => hdr.findIndex((w) => w.text === h));
  if (starts.some((s, i) => s < 0 || (i && s <= starts[i - 1])))
    throw new Error(`IDFC p${pn}: unexpected transaction table header`);
  const centres = starts.map((s, i) => {
    const grp = hdr.slice(s, i + 1 < starts.length ? starts[i + 1] : hdr.length);
    return (grp[0].x0 + grp.at(-1)!.x1) / 2;
  });
  const edges = [hdr[0].x0 - 2];
  for (const c of centres) edges.push(2 * c - edges.at(-1)!);
  const col = (w: Word) => edges.findIndex((e, i) => i < 7 && e <= (w.x0 + w.x1) / 2 && (w.x0 + w.x1) / 2 < edges[i + 1]);

  // body: below the 2-line header, until the first vertical gap wider than any row
  const all = lines(ws.filter((w) => w.top > top + 15 && col(w) >= 0));
  const body: Word[][] = [];
  for (const ln of all) {
    if (body.length && ln[0].top - body.at(-1)![0].top > 16) break;
    body.push(ln);
  }
  const dated = (ln: Word[]) => ln.some((w) => col(w) === 0);
  const special = (ln: Word[]) => dated(ln) || ln.some((w) => col(w) >= 4);

  const rows: string[][] = [];
  for (let i = 0; i < body.length; ) {
    let j = i;
    while (j < body.length && !special(body[j])) j++;
    if (j === body.length) break;
    let k = j + 1;
    if (dated(body[j])) {
      const limit = 2 * body[j][0].top - body[i][0].top + 1;
      while (k < body.length && !special(body[k]) && body[k][0].top <= limit) k++;
    }
    const cells: Word[][] = Array.from({ length: 7 }, () => []);
    for (const ln of body.slice(i, k)) for (const w of ln) cells[col(w)].push(w);
    rows.push(cells.map((c) => join(lines(c, 1.99))));
    i = k;
  }
  return rows;
}

export const idfc: Reader = {
  detect: (text) => /IDFC FIRST BANK/i.test(text) && /CONSOLIDATED STATEMENT/i.test(text),
  parse(pages) {
    const m = SUMMARY.exec(pages[0]?.text.replace(/\s+/g, " ") ?? "");
    if (!m) throw new Error("IDFC: savings summary line not found on page 1");
    const opening = bal(m[1], m[2]), nWd = +m[3], nDep = +m[4];
    const totWd = num(m[5]), totDep = num(m[6]), closing = bal(m[7], m[8]);

    const out: StmtRow[] = [];
    let run = opening;
    pages.forEach((page, p) => {
      for (const [date, , desc, ref, wd, dep, balance] of pageRows(page, p + 1)) {
        const d = DATE.exec(date);
        if (!d) {
          if (/^(opening|closing) balance$/i.test(desc)) continue;
          if (desc || wd || dep) throw new Error(`IDFC p${p + 1}: row without date: ${JSON.stringify(desc.slice(0, 40))}`);
          continue;
        }
        if (!wd === !dep) throw new Error(`IDFC ${d[0]}: need exactly one of withdrawal/deposit: ${JSON.stringify(desc.slice(0, 40))}`);
        const amount = wd ? -num(wd) : num(dep);
        run = r2(run + amount);
        const b = balance.split(" ");
        if (balance && Math.abs(run - bal(b[0], b[1])) > 0.005)
          throw new Error(`IDFC ${d[0]}: running balance ${run.toFixed(2)} != statement ${balance} (${JSON.stringify(desc.slice(0, 40))})`);
        const mi = MON.indexOf(d[2]);
        if (mi < 0) throw new Error(`IDFC: bad month in ${d[0]}`);
        const r = REF.exec(desc);
        out.push({
          date: `20${d[3]}-${String(mi + 1).padStart(2, "0")}-${d[1]}`,
          description: desc,
          amount,
          ...((ref || r) && { ref: ref || r![1] }),
        });
      }
    });

    const debits = out.filter((r) => r.amount < 0).map((r) => r.amount);
    const credits = out.filter((r) => r.amount > 0).map((r) => r.amount);
    const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
    const checks: [number, number, string][] = [
      [debits.length, nWd, "withdrawal count"],
      [credits.length, nDep, "deposit count"],
      [r2(-sum(debits)), totWd, "withdrawals total"],
      [r2(sum(credits)), totDep, "deposits total"],
      [r2(opening + sum(out.map((r) => r.amount))), closing, "opening + txns vs closing"],
    ];
    for (const [got, want, what] of checks)
      if (Math.abs(got - want) > 0.005) throw new Error(`IDFC ${what}: parsed ${got} != statement ${want}`);
    return out;
  },
};
