import { getDocumentProxy } from "unpdf";

/** One word on a page. Coordinates mirror pdfplumber: origin top-left, top grows downward. */
export type Word = { text: string; x0: number; x1: number; top: number; bottom: number };
export type Page = { words: Word[]; text: string; width: number; height: number };

export class LockedPdfError extends Error {}

/** STATEMENT_PASSWORDS env (comma-separated), never hardcoded: this repo is public. "" first for unlocked PDFs. */
const passwords = () => ["", ...(process.env.STATEMENT_PASSWORDS ?? "").split(",").map((p) => p.trim()).filter(Boolean)];

async function open(data: Uint8Array) {
  for (const password of passwords()) {
    try {
      // pdfjs detaches the buffer it is given, so hand it a copy each try
      return await getDocumentProxy(data.slice(), { password });
    } catch (e) {
      if ((e as Error)?.name !== "PasswordException") throw e;
    }
  }
  throw new LockedPdfError("PDF is password-protected and none of STATEMENT_PASSWORDS opened it");
}

type Item = { str: string; transform: number[]; width: number; height: number };

/** Split pdfjs text runs into words, then glue runs that touch (pdfjs often splits one word across runs). */
function toWords(items: Item[], pageHeight: number): Word[] {
  const words: Word[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const [, , , d, x, y] = it.transform;
    const h = it.height || Math.abs(d);
    const top = pageHeight - y - h;
    const cw = it.width / it.str.length; // ponytail: proportional char width, exact enough for column bucketing
    for (const m of it.str.matchAll(/\S+/g)) {
      const x0 = x + m.index * cw;
      const w: Word = { text: m[0], x0, x1: x0 + m[0].length * cw, top, bottom: top + h };
      const prev = words.at(-1);
      if (prev && m.index === 0 && Math.abs(prev.top - top) < 1 && w.x0 - prev.x1 < 1) {
        prev.text += w.text;
        prev.x1 = w.x1;
      } else words.push(w);
    }
  }
  return words.sort((a, b) => a.top - b.top || a.x0 - b.x0);
}

/** Group words into lines (same top within tol), each line sorted left to right. */
export function lines(words: Word[], tol = 2): Word[][] {
  const out: Word[][] = [];
  for (const w of [...words].sort((a, b) => a.top - b.top || a.x0 - b.x0)) {
    const line = out.at(-1);
    if (line && Math.abs(line[0].top - w.top) <= tol) line.push(w);
    else out.push([w]);
  }
  return out.map((l) => l.sort((a, b) => a.x0 - b.x0));
}

export async function readPdf(data: Uint8Array): Promise<Page[]> {
  const doc = await open(data);
  const pages: Page[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const { width, height } = p.getViewport({ scale: 1 });
    const words = toWords((await p.getTextContent()).items as Item[], height);
    pages.push({ words, width, height, text: lines(words).map((l) => l.map((w) => w.text).join(" ")).join("\n") });
  }
  return pages;
}
