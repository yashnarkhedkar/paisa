import { describe, expect, it } from "vitest";
import { summarise } from "@/lib/summary";

const cat = (name: string, isSpending = true) => ({ name, isSpending });

describe("summarise", () => {
  it("nets friends' paybacks off spending, FD maturity off savings, ignores transfers", () => {
    const s = summarise([
      { amount: 122013, category: cat("Income", false) },
      { amount: -2000, category: cat("Food") },
      { amount: 1000, category: cat("Reimbursement", false) },
      { amount: -500, category: null }, // uncategorised debit counts as spending
      { amount: -90000, category: cat("FD", false) },
      { amount: 50000, category: cat("FD", false) },
      { amount: -35000, category: cat("Transfer", false) },
      { amount: 35000, category: cat("Transfer", false) },
    ]);
    expect(s).toEqual({ spent: 1500, income: 122013, saved: 40000, net: 120513 });
  });
});
