export type RuleLite = { keyword: string; categoryId: number };
export type Fallback = { incomeId: number; transferId: number };

const TRANSFER = ["credit card", "cc payment", "card payment"];

export function categorise(desc: string, amount: number, rules: RuleLite[], fallback: Fallback): number | null {
  const d = desc.toLowerCase();
  const rule = rules.find((r) => d.includes(r.keyword));
  if (rule) return rule.categoryId;
  if (TRANSFER.some((k) => d.includes(k))) return fallback.transferId;
  if (amount > 0) return fallback.incomeId;
  return null;
}

const NOISE = new Set(["upi", "dr", "cr", "neft", "imps", "rtgs", "pos", "ach", "nach", "pay", "payment", "to", "from", "by", "the", "of", "india", "ltd", "pvt", "inr", "ref", "txn", "ecom", "atm"]);

/** Derive a rule keyword from a bank narration. "UPI-DR-123-SWIGGY BLR" -> "swiggy blr". Returns "" if nothing safe. */
export function merchantKeyword(description: string): string {
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
