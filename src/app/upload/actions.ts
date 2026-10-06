"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseStatementCsv, type Bad, type Row } from "@/lib/csv";
import { categorise } from "@/lib/categorise";

export type PreviewRow = Row & { categoryId: number | null; categoryName: string; dup: boolean };
export type Preview = { rows: PreviewRow[]; bad: Bad[]; error?: string };

export async function previewCsv(formData: FormData): Promise<Preview> {
  const file = formData.get("file");
  const selected = String(formData.get("account") ?? "");
  if (!(file instanceof File) || !file.size) return { rows: [], bad: [], error: "No file" };

  let text = await file.text();
  // fill blank account column with selected account
  if (selected) text = text.replace(/^(\d{4}-\d{2}-\d{2}),(?=,)/gm, `$1,${selected}`);

  const [accounts, rules, cats] = await Promise.all([
    db.account.findMany({ select: { code: true } }),
    db.rule.findMany({ select: { keyword: true, categoryId: true } }),
    db.category.findMany({ select: { id: true, name: true } }),
  ]);
  const byId = new Map(cats.map((c) => [c.id, c.name]));
  const fallback = {
    incomeId: cats.find((c) => c.name === "Income")?.id ?? -1,
    transferId: cats.find((c) => c.name === "Transfer")?.id ?? -1,
  };

  const { ok, bad } = parseStatementCsv(text, accounts.map((a) => a.code));
  const existing = new Set(
    (await db.transaction.findMany({ where: { hash: { in: ok.map((r) => r.hash) } }, select: { hash: true } })).map((t) => t.hash),
  );
  const seen = new Set<string>();
  const rows = ok.map((r) => {
    const categoryId = categorise(r.description, r.amount, rules, fallback);
    const dup = existing.has(r.hash) || seen.has(r.hash);
    seen.add(r.hash);
    return { ...r, categoryId: categoryId === -1 ? null : categoryId, categoryName: byId.get(categoryId ?? -1) ?? "—", dup };
  });
  return { rows, bad };
}

export async function importRows(json: string): Promise<{ imported: number; duplicates: number }> {
  const rows = JSON.parse(json) as PreviewRow[];
  const accounts = await db.account.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const data = rows.flatMap((r) => {
    const accountId = idByCode.get(r.account);
    return accountId
      ? [{ accountId, date: new Date(r.date), description: r.description, amount: r.amount, ref: r.ref ?? null, categoryId: r.categoryId, hash: r.hash }]
      : [];
  });
  const { count } = await db.transaction.createMany({ data, skipDuplicates: true });
  revalidatePath("/transactions");
  revalidatePath("/");
  return { imported: count, duplicates: rows.length - count };
}
