"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { applyRule, reimbursementId } from "@/lib/rules";

const refresh = () => {
  revalidatePath("/transactions");
  revalidatePath("/");
};

/**
 * Set the category on one or many rows (a group). `later` skips the page refresh so the row stays on screen
 * while the "remember?" question is open (in the Uncategorised view it would vanish at once).
 */
export async function setCategory(ids: number[], categoryId: number | null, later = false) {
  if (!ids.length) return;
  await db.transaction.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
  if (!later) refresh();
}

/** Asked after the pick: save keyword -> category and apply it to rows still uncategorised. Returns rows tagged. */
export async function rememberRule(keyword: string, categoryId: number): Promise<number> {
  const kw = keyword.trim().toLowerCase();
  // ponytail: same 5-char floor as merchantKeyword, else "ola" matches "chocolate"
  if (kw.length < 5 || !categoryId) return 0;
  await db.rule.upsert({ where: { keyword: kw }, create: { keyword: kw, categoryId }, update: { categoryId } });
  const count = await applyRule(kw, categoryId, await reimbursementId());
  refresh();
  return count;
}
