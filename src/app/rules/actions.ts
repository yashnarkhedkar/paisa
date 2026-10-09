"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { LOCKED } from "@/lib/categorise";
import { applyAllRules, applyRule, reimbursementId } from "@/lib/rules";

const refresh = () => {
  revalidatePath("/rules");
  revalidatePath("/transactions");
  revalidatePath("/");
};

export async function addRule(formData: FormData) {
  const keyword = String(formData.get("keyword") ?? "").trim().toLowerCase();
  const categoryId = Number(formData.get("categoryId"));
  if (!keyword || !categoryId) return;
  await db.rule.upsert({ where: { keyword }, create: { keyword, categoryId }, update: { categoryId } });
  // a new rule should also fix rows already imported, not just future uploads
  await applyRule(keyword, categoryId, await reimbursementId());
  refresh();
}

export async function reapplyRules() {
  await applyAllRules();
  refresh();
}

export async function deleteRule(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.rule.delete({ where: { id } });
  revalidatePath("/rules");
}


export async function saveCategory(formData: FormData) {
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const isSpending = formData.get("isSpending") === "on";
  if (!name) return;
  if (id) {
    const cur = await db.category.findUnique({ where: { id } });
    if (!cur) return;
    await db.category.update({ where: { id }, data: { isSpending, ...(LOCKED.includes(cur.name) ? {} : { name }) } });
  } else {
    await db.category.upsert({ where: { name }, create: { name, isSpending }, update: {} });
  }
  revalidatePath("/rules");
  revalidatePath("/transactions");
  revalidatePath("/");
}

/** Its transactions become uncategorised, its rules go with it (schema: SetNull / Cascade). */
export async function deleteCategory(formData: FormData) {
  const id = Number(formData.get("id"));
  const cur = id ? await db.category.findUnique({ where: { id } }) : null;
  if (!cur || LOCKED.includes(cur.name)) return;
  await db.category.delete({ where: { id } });
  revalidatePath("/rules");
  revalidatePath("/transactions");
  revalidatePath("/");
}
