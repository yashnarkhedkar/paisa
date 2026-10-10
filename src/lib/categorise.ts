// The dashboard and fallbacks look these up by name, so the UI won't rename or delete them.
export const LOCKED = ["Income", "Transfer", "Reimbursement"];

export type RuleLite = { keyword: string; categoryId: number };
export type Fallback = { transferId: number; reimbursementId?: number };

const TRANSFER = ["credit card", "cc payment", "card payment"];

/** Does a rule keyword match this narration? Raw text, or the cleaned words merchantKeyword builds keywords from
 *  ("RAHUL K/SBIN" -> "rahul sbin"), else keywords saved from "group similar" never match their own rows. */
export function matches(desc: string, keyword: string): boolean {
  const d = desc.toLowerCase();
  return d.includes(keyword) || words(d).join(" ").includes(keyword);
}

export function categorise(desc: string, amount: number, rules: RuleLite[], fallback: Fallback): number | null {
  const d = desc.toLowerCase();
  // Reimbursement rules only claim money coming in (see lib/rules.ts)
  // longest matching keyword wins: "ola cabs" beats "ola", whichever rule was added first
  const rule = rules
    .filter((r) => matches(d, r.keyword) && !(r.categoryId === fallback.reimbursementId && amount < 0))
    .reduce<RuleLite | undefined>((best, r) => (!best || r.keyword.length > best.keyword.length ? r : best), undefined);
  if (rule) return rule.categoryId;
  if (TRANSFER.some((k) => d.includes(k))) return fallback.transferId;
  // No "credit = Income" guess: own-account transfers and friends paying back are credits too, and a guessed
  // category blocks rules added later (they only touch uncategorised rows). Salary gets its own rule instead.
  return null;
}

/**
 * Who a credit came from, readable: the first narration segment that looks like a name or a UPI id.
 * "NEFT-SCBLH181007-ACME SOFTWARE PRIVATE" -> "ACME SOFTWARE PRIVATE", "UPI/1/12:00:00/UPI/9000000001@ybl/Paym" -> "9000000001@ybl".
 */
export function payer(description: string): string {
  const seg = description
    .split(/[/,-]/)
    .map((s) => s.trim())
    .find((s) => {
      const letters = (s.match(/[a-z]/gi) ?? []).length;
      const digits = (s.match(/\d/g) ?? []).length;
      if (s.includes("@")) return letters >= 2;
      if (STOP.has(s.toLowerCase())) return false;
      // a name: words with more letters than digits, or one clean word ("AMUL", "ERODHABROKING")
      return s.includes(" ") ? letters >= 3 && letters > digits : letters >= 4 && digits === 0;
    });
  return seg ?? description.trim();
}
// narration codes that look like words
const STOP = new Set(["upi", "neft", "imps", "rtgs", "mbk", "achcr", "achdr", "paym", "sent", "paid", "payment"]);

const words = (lower: string) =>
  lower
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NOISE.has(w));

const NOISE = new Set(["upi", "dr", "cr", "neft", "imps", "rtgs", "pos", "ach", "nach", "pay", "payment", "to", "from", "by", "the", "of", "india", "ltd", "pvt", "inr", "ref", "txn", "ecom", "atm"]);

/**
 * Derive a rule keyword from a bank narration. Also the grouping key on /transactions.
 * "UPI/123/UPI/9850828135@ybl/Paym" -> "9850828135@" (the UPI id: keeps digits, so each payee is distinct)
 * "UPI-DR-123-SWIGGY BLR" -> "swiggy blr". Returns "" if nothing safe.
 */
export function merchantKeyword(description: string): string {
  const vpa = description.toLowerCase().match(/([a-z0-9][a-z0-9._-]{3,})@[a-z]/);
  if (vpa) return `${vpa[1]}@`;
  const w = words(description.toLowerCase());
  let kw = w.slice(0, 2).join(" ");
  if (kw.length < 5) kw = w.slice(0, 3).join(" ");
  // ponytail: min 5 chars, else "ola" matches "chocolate"
  return kw.length >= 5 ? kw : "";
}
