"use server";

import { AccountKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createAccount(fd: FormData) {
  const code = str(fd, "code").toUpperCase();
  const name = str(fd, "name");
  const kind = str(fd, "kind") as AccountKind;
  if (!code || !name || !Object.values(AccountKind).includes(kind)) throw new Error("code/name/kind required");
  await db.account.create({ data: { code, name, kind } });
  revalidatePath("/accounts");
}

export async function renameAccount(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("name required");
  await db.account.update({ where: { id: Number(fd.get("id")) }, data: { name } });
  revalidatePath("/accounts");
}

export async function deleteAccount(fd: FormData) {
  await db.account.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}
