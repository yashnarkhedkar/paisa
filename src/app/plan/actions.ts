"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { LOCKED } from "@/lib/categorise";

const refresh = () => {
  revalidatePath("/plan");
  revalidatePath("/");
};

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Positive amount, or null when invalid. */
const positive = (f: FormData, k: string) => {
  const n = Number(str(f, k));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const id = (f: FormData, k = "id") => {
  const n = Number(f.get(k));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** YYYY-MM-DD from <input type="date">; null when empty, undefined when malformed. */
const dateOrNull = (f: FormData, k: string) => {
  const s = str(f, k);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(s + "T00:00:00Z");
  return isNaN(d.getTime()) ? undefined : d;
};

/** Linked category must be a non-spending, unlocked one; "" = none. undefined = invalid. */
async function goalCategory(f: FormData) {
  if (!str(f, "categoryId")) return null;
  const cid = id(f, "categoryId");
  if (!cid) return undefined;
  const c = await db.category.findUnique({ where: { id: cid } });
  if (!c || c.isSpending || LOCKED.includes(c.name)) return undefined;
  return cid;
}

async function goalFields(f: FormData) {
  const name = str(f, "name");
  const target = positive(f, "target");
  const baseRaw = str(f, "base");
  const base = baseRaw === "" ? 0 : Number(baseRaw);
  const deadline = dateOrNull(f, "deadline");
  const categoryId = await goalCategory(f);
  if (!name || target === null || !Number.isFinite(base) || base < 0 || deadline === undefined || categoryId === undefined) return null;
  return { name, target, base, deadline, categoryId };
}

export async function addGoal(formData: FormData) {
  const data = await goalFields(formData);
  if (!data) return;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  await db.goal.create({ data: { ...data, countFrom: today } });
  refresh();
}

export async function saveGoal(formData: FormData) {
  const gid = id(formData);
  const data = await goalFields(formData);
  if (!gid || !data) return;
  await db.goal.updateMany({ where: { id: gid }, data });
  refresh();
}

export async function deleteGoal(formData: FormData) {
  const gid = id(formData);
  if (!gid) return;
  await db.goal.deleteMany({ where: { id: gid } });
  refresh();
}

/** Empty input clears the budget. Only spending categories get budgets. */
export async function saveBudget(formData: FormData) {
  const cid = id(formData);
  if (!cid) return;
  const raw = str(formData, "budget");
  const budget = raw === "" ? null : positive(formData, "budget");
  if (raw !== "" && budget === null) return;
  await db.category.updateMany({ where: { id: cid, isSpending: true }, data: { budget } });
  refresh();
}

export async function addFixedPayment(formData: FormData) {
  const name = str(formData, "name");
  const amount = positive(formData, "amount");
  if (!name || amount === null) return;
  await db.fixedPayment.create({ data: { name, amount } });
  refresh();
}

export async function deleteFixedPayment(formData: FormData) {
  const fid = id(formData);
  if (!fid) return;
  await db.fixedPayment.deleteMany({ where: { id: fid } });
  refresh();
}
