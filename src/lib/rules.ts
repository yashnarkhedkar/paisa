import { db } from "@/lib/db";
import { matches } from "@/lib/categorise";

/**
 * Tag still-uncategorised rows the keyword matches (same matcher as import). Returns rows tagged.
 * Reimbursement rules only match money coming in: a friend's UPI id also appears on what you send them,
 * and that is real spending.
 */
export async function applyRule(keyword: string, categoryId: number, reimbursementId?: number) {
  // ponytail: scans uncategorised rows in JS (matcher isn't SQL-able); fine at a few thousand rows
  const rows = await db.transaction.findMany({
    where: { categoryId: null, ...(categoryId === reimbursementId ? { amount: { gt: 0 } } : {}) },
    select: { id: true, description: true },
  });
  const ids = rows.filter((r) => matches(r.description, keyword)).map((r) => r.id);
  if (!ids.length) return 0;
  const { count } = await db.transaction.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
  return count;
}

export const reimbursementId = async () =>
  (await db.category.findUnique({ where: { name: "Reimbursement" }, select: { id: true } }))?.id;

/** Run every rule over uncategorised rows, longest keyword first so the most specific rule claims a row (same as categorise). */
export async function applyAllRules() {
  const [all, rid] = await Promise.all([db.rule.findMany(), reimbursementId()]);
  const rules = all.sort((a, b) => b.keyword.length - a.keyword.length);
  let n = 0;
  for (const r of rules) n += await applyRule(r.keyword, r.categoryId, rid);
  return n;
}
