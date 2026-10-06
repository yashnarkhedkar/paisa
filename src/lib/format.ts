export const inr = (n: number | string | { toString(): string }) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/** YYYY-MM */
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
