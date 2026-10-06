"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function addRule(formData: FormData) {
  const keyword = String(formData.get("keyword") ?? "").trim().toLowerCase();
  const categoryId = Number(formData.get("categoryId"));
  if (!keyword || !categoryId) return;
  await db.rule.upsert({ where: { keyword }, create: { keyword, categoryId }, update: { categoryId } });
  revalidatePath("/rules");
}

export async function deleteRule(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.rule.delete({ where: { id } });
  revalidatePath("/rules");
}
