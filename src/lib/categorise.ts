// The dashboard and fallbacks look these up by name, so the UI won't rename or delete them.
export const LOCKED = ["Income", "Transfer", "Reimbursement"];

export type RuleLite = { keyword: string; categoryId: number };
export type Fallback = { incomeId: number; transferId: number; reimbursementId?: number };

const TRANSFER = ["credit card", "cc payment", "card payment"];

export function categorise(desc: string, amount: number, rules: RuleLite[], fallback: Fallback): number | null {
  const d = desc.toLowerCase();
  // Reimbursement rules only claim money coming in (see lib/rules.ts)
  // longest matching keyword wins: "yash santosh" (FD) beats "yash san" (own UPI)
  const rule = rules
    .filter((r) => d.includes(r.keyword) && !(r.categoryId === fallback.reimbursementId && amount < 0))
    .reduce<RuleLite | undefined>((best, r) => (!best || r.keyword.length > best.keyword.length ? r : best), undefined);
  if (rule) return rule.categoryId;
  if (TRANSFER.some((k) => d.includes(k))) return fallback.transferId;
  if (amount > 0) return fallback.incomeId;
  return null;
}

const NOISE = new Set(["upi", "dr", "cr", "neft", "imps", "rtgs", "pos", "ach", "nach", "pay", "payment", "to", "from", "by", "the", "of", "india", "ltd", "pvt", "inr", "ref", "txn", "ecom", "atm"]);

/**
 * Derive a rule keyword from a bank narration. Also the grouping key on /transactions.
 * "UPI/123/UPI/9850828135@ybl/Paym" -> "9850828135@" (the UPI id: keeps digits, so each payee is distinct)
 * "UPI-DR-123-SWIGGY BLR" -> "swiggy blr". Returns "" if nothing safe.
 */
export function merchantKeyword(description: string): string {
  const vpa = description.toLowerCase().match(/([a-z0-9][a-z0-9._-]{3,})@[a-z]/);
  if (vpa) return `${vpa[1]}@`;
  const words = description
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NOISE.has(w));
  let kw = words.slice(0, 2).join(" ");
  if (kw.length < 5) kw = words.slice(0, 3).join(" ");
  // ponytail: min 5 chars, else "ola" matches "chocolate"
  return kw.length >= 5 ? kw : "";
}
