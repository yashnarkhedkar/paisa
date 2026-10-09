/**
 * Bank of Baroda savings-account statement reader (port of scripts/statements/bob.py).
 * Text-layer rows are misaligned (narration wraps above/below its amounts), so we use word
 * coordinates: each BALANCE value ("... Cr") anchors one row; date/amounts on the same line,
 * narration lines go to the nearest anchor.
 */
import type { Reader, StmtRow } from "./index";
import { lines, type Page } from "./pdf";

const DATE = /^\d\d-\d\d-\d{4}$/;
const NUM = /^\d+\.\d\d$/;
const NEAR = 14; // max vertical distance (pt) between a narration line and its anchor

type Anchor = { top: number; bal: number; date: string | null; amt: number | null; lines: Map<number, string[]> };

const detect = (text: string) => text.toLowerCase().includes("bankofbaroda") && text.includes("WITHDRAWAL (DR)");

function pageRows(page: Page): Anchor[] {
  const words = lines(page.words).flat();
  const head: Record<string, (typeof words)[number]> = {};
  for (const w of words) if (["DATE", "CHQ.NO.", "DEPOSIT", "BALANCE"].includes(w.text)) head[w.text] = w;
  if (Object.keys(head).length < 4) return [];
  const chqX = head["CHQ.NO."].x0, depX = head["DEPOSIT"].x0, balX = head["BALANCE"].x0 - 20;
  const body = words.filter((w) => w.top > head["DATE"].bottom + 2);

  const anchors: Anchor[] = []; // balance + "Cr"/"Dr" marker pairs
  for (let i = 0; i < body.length - 1; i++) {
    const w = body[i], nxt = body[i + 1];
    if (w.x0 >= balX && NUM.test(w.text) && (nxt.text === "Cr" || nxt.text === "Dr") && Math.abs(nxt.top - w.top) < 3)
      anchors.push({ top: w.top, bal: +w.text * (nxt.text === "Cr" ? 1 : -1), date: null, amt: null, lines: new Map() });
  }
  if (!anchors.length) return [];

  for (const w of body) {
    if (w.x0 >= balX || w.text === "Cr" || w.text === "Dr") continue;
    const a = anchors.reduce((b, c) => (Math.abs(c.top - w.top) < Math.abs(b.top - w.top) ? c : b));
    const dist = Math.abs(a.top - w.top);
    if (dist > NEAR) continue;
    const same = dist < 3;
    if (same && DATE.test(w.text) && w.x0 < chqX) a.date = w.text;
    else if (same && w.x0 >= chqX && NUM.test(w.text)) a.amt = +w.text * (w.x0 >= depX - 10 ? 1 : -1);
    else if (w.x0 < chqX) {
      const k = Math.round(w.top);
      a.lines.set(k, [...(a.lines.get(k) ?? []), w.text]);
    }
  }
  return anchors;
}

function narration(ls: Map<number, string[]>): string {
  let out = "", prev = "";
  for (const k of [...ls.keys()].sort((x, y) => x - y)) {
    const piece = ls.get(k)!.join(" ");
    // previous line was one token -> it wrapped mid-token (UPI ids): glue; else keep a space
    out += !out || !prev.includes(" ") ? piece : " " + piece;
    prev = piece;
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function parse(pages: Page[]): StmtRow[] {
  let opening: number | null = null, closing: number | null = null, bal: number | null = null;
  const rows: StmtRow[] = [];
  for (const a of pages.flatMap(pageRows)) {
    const desc = narration(a.lines);
    if (desc.startsWith("Opening Balance")) { opening = bal = a.bal; continue; }
    if (desc.startsWith("Closing Balance")) { closing = a.bal; break; }
    if (bal === null || a.date === null || a.amt === null) throw new Error(`BoB: malformed row near balance ${a.bal}: ${JSON.stringify(desc)}`);
    if (r2(bal + a.amt - a.bal) !== 0)
      throw new Error(`BoB: running balance mismatch at ${a.date} ${JSON.stringify(desc)}: ${bal.toFixed(2)} + ${a.amt.toFixed(2)} != ${a.bal.toFixed(2)}`);
    bal = a.bal;
    const [d, m, y] = a.date.split("-");
    const ref = desc.match(/^(?:UPI|MBK)\/(\d{9,})\//) ?? desc.match(/^NEFT-(\w+)-/);
    rows.push({ date: `${y}-${m}-${d}`, description: desc, amount: a.amt, ...(ref ? { ref: ref[1] } : {}) });
  }
  if (opening === null || closing === null) throw new Error("BoB: opening/closing balance not found");
  const total = r2(opening + rows.reduce((s, r) => s + r.amount, 0));
  if (total !== r2(closing)) throw new Error(`BoB: opening ${opening.toFixed(2)} + sum ${(total - opening).toFixed(2)} != closing ${closing.toFixed(2)}`);
  return rows;
}

export const bob: Reader = { detect, parse };
