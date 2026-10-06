"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { merchantKeyword } from "@/lib/categorise";

export async function setCategory(id: number, categoryId: number | null, remember: boolean) {
  const tx = await db.transaction.update({ where: { id }, data: { categoryId } });

  if (remember && categoryId) {
    const kw = merchantKeyword(tx.description);
    if (kw) {
      await db.rule.upsert({
        where: { keyword: kw },
        create: { keyword: kw, categoryId },
        update: { categoryId },
      });
      await db.transaction.updateMany({
        where: { categoryId: null, description: { contains: kw, mode: "insensitive" } },
        data: { categoryId },
      });
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/");
}
