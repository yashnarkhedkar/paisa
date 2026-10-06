import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const categories: [string, boolean][] = [
  ["Food", true], ["Groceries", true], ["Transport", true], ["Shopping", true],
  ["Bills", true], ["Rent", true], ["Health", true], ["Entertainment", true],
  ["Subscriptions", true], ["Family", true], ["Fees", true], ["Other", true],
  ["Investment", false], ["Income", false], ["Transfer", false],
];
const accounts: [string, string, "BANK" | "CARD"][] = [
  ["HDFC-SAV", "HDFC Savings", "BANK"],
  ["SBI-SAV", "SBI Savings", "BANK"],
  ["CC-1", "Credit Card 1", "CARD"],
  ["CC-2", "Credit Card 2", "CARD"],
  ["CC-3", "Credit Card 3", "CARD"],
];

// keyword (lowercase substring of description) -> category. Starter rules; edit on /rules.
const rules: [string, string][] = [
  ["zerodha", "Investment"], ["gold scheme", "Investment"], ["fixed deposit", "Investment"],
  ["card payment", "Transfer"], ["cc payment", "Transfer"], ["credit card", "Transfer"],
  ["hdfc life", "Bills"], ["salary", "Income"],
  ["swiggy", "Food"], ["zomato", "Food"], ["bigbasket", "Groceries"], ["blinkit", "Groceries"],
  ["uber", "Transport"], ["ola cabs", "Transport"], ["olacabs", "Transport"], ["rapido", "Transport"],
  ["netflix", "Subscriptions"], ["spotify", "Subscriptions"], ["amazon", "Shopping"],
];

async function main() {
  for (const [name, isSpending] of categories)
    await db.category.upsert({ where: { name }, update: {}, create: { name, isSpending } });
  for (const [code, name, kind] of accounts)
    await db.account.upsert({ where: { code }, update: {}, create: { code, name, kind } });
  for (const [keyword, cat] of rules) {
    const category = await db.category.findUniqueOrThrow({ where: { name: cat } });
    await db.rule.upsert({ where: { keyword }, update: {}, create: { keyword, categoryId: category.id } });
  }
}
main().finally(() => db.$disconnect());
