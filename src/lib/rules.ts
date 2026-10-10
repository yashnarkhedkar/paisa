import { db } from "@/lib/db";

/**
 * Tag still-uncategorised rows whose description contains the keyword. Returns rows tagged.
 * Reimbursement rules only match money coming in: a friend's UPI id also appears on what you send them,
 * and that is real spending.
 */
export async function applyRule(keyword: string, categoryId: number, reimbursementId?: number) {
  const { count } = await db.transaction.updateMany({
    where: {
      categoryId: null,
      description: { contains: keyword, mode: "insensitive" },
      ...(categoryId === reimbursementId ? { amount: { gt: 0 } } : {}),
    },
    data: { categoryId },
  });
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
