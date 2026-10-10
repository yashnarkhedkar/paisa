import { LOCKED } from "@/lib/categorise";

type Cat = { name: string; isSpending: boolean } | null;
type Txn = { amount: number; category: Cat };

/** Savings bucket: non-spending and not Income/Transfer/Reimbursement (Gold, FD, Investment...). */
export const isSaving = (c: Cat) => !!c && !c.isSpending && !LOCKED.includes(c.name);

/**
 * One month's headline numbers. Home, month-vs-month and the 6-month trend all use this so they agree.
 * spent: spending debits minus friends paying back. saved: net put into savings buckets (FD maturity nets off).
 */
export function summarise(txns: Txn[]) {
  let spent = 0, income = 0, saved = 0;
  for (const { amount, category: c } of txns) {
    if (amount < 0 && (c?.isSpending ?? true)) spent -= amount;
    else if (amount > 0 && c?.name === "Reimbursement") spent -= amount;
    else if (amount > 0 && c?.name === "Income") income += amount;
    if (isSaving(c)) saved -= amount;
  }
  return { spent, income, saved, net: income - spent };
}
