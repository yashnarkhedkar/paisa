import Papa from "papaparse";
import { txnHash } from "./hash";

export type Row = {
  line: number;
  date: string;
  account: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  ref?: string;
  hash: string;
};
export type Bad = { line: number; reason: string };

type Raw = Record<string, string | undefined>;

const isValidDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

export function parseStatementCsv(text: string, accountCodes: string[]): { ok: Row[]; bad: Bad[] } {
  const ok: Row[] = [];
  const bad: Bad[] = [];
  const { data } = Papa.parse<Raw>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const codes = new Set(accountCodes);

  data.forEach((r, i) => {
    const line = i + 2;
    const date = (r.date ?? "").trim();
    const account = (r.account ?? "").trim();
    const description = (r.description ?? "").trim();
    const amount = Number((r.amount ?? "").trim());
    const type = (r.type ?? "").trim().toUpperCase();
    const ref = (r.ref ?? "").trim() || undefined;

    if (!isValidDate(date)) return bad.push({ line, reason: `bad date "${date}" (want YYYY-MM-DD)` });
    if (!codes.has(account)) return bad.push({ line, reason: `unknown account "${account}"` });
    if (!description) return bad.push({ line, reason: "empty description" });
    if (!Number.isFinite(amount) || amount === 0) return bad.push({ line, reason: `bad amount "${r.amount ?? ""}"` });
    if (type !== "DEBIT" && type !== "CREDIT") return bad.push({ line, reason: `bad type "${type}"` });
    if ((type === "DEBIT") !== amount < 0) return bad.push({ line, reason: `type ${type} disagrees with amount ${amount}` });

    ok.push({ line, date, account, description, amount, type, ref, hash: txnHash(account, date, amount, description, ref) });
  });

  return { ok, bad };
}
