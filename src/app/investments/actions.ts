"use server";

import { HoldingKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { db } from "@/lib/db";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (v: string) => {
  const n = Number(v.replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Bad number: ${v}`);
  return n;
};

export async function upsertHolding(fd: FormData) {
  const kind = str(fd, "kind") as HoldingKind;
  const symbol = str(fd, "symbol").toUpperCase();
  if (!symbol || !Object.values(HoldingKind).includes(kind)) throw new Error("kind/symbol required");
  const qty = num(str(fd, "qty"));
  const avgPrice = num(str(fd, "avgPrice"));
  const cur = str(fd, "currentPrice");
  const currentPrice = cur ? num(cur) : null;
  const note = str(fd, "note") || null;
  const data = { qty, avgPrice, currentPrice, note };
  await db.holding.upsert({
    where: { kind_symbol: { kind, symbol } },
    create: { kind, symbol, ...data },
    update: data,
  });
  revalidatePath("/investments");
}

export async function deleteHolding(fd: FormData) {
  await db.holding.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath("/investments");
}

export async function importZerodha(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("No file");
  const { data } = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: true,
  });
  const col = (row: Record<string, string>, p: string) =>
    Object.keys(row).find((k) => k.trim().toLowerCase().startsWith(p));
  let count = 0;
  for (const row of data) {
    const s = col(row, "instrument"), q = col(row, "qty"), a = col(row, "avg"), l = col(row, "ltp");
    if (!s || !q || !a) continue;
    const symbol = (row[s] ?? "").trim().toUpperCase();
    const qty = Number((row[q] ?? "").replace(/,/g, ""));
    const avgPrice = Number((row[a] ?? "").replace(/,/g, ""));
    const ltp = l ? Number((row[l] ?? "").replace(/,/g, "")) : NaN;
    if (!symbol || !Number.isFinite(qty) || !Number.isFinite(avgPrice)) continue;
    const currentPrice = Number.isFinite(ltp) ? ltp : null;
    await db.holding.upsert({
      where: { kind_symbol: { kind: HoldingKind.STOCK, symbol } },
      create: { kind: HoldingKind.STOCK, symbol, qty, avgPrice, currentPrice },
      update: { qty, avgPrice, currentPrice },
    });
    count++;
  }
  revalidatePath("/investments");
  redirect(`/investments?imported=${count}`);
}
