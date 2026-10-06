import { createHash } from "node:crypto";

/**
 * Dedupe fingerprint. Includes `ref` when present so two real same-day payments
 * with different UPI refs are kept. Without a ref, identical rows collapse to one
 * (that is what makes re-uploading a statement safe).
 */
export const txnHash = (account: string, date: string, amount: number, description: string, ref = "") =>
  createHash("sha256")
    .update(`${account}|${date}|${amount.toFixed(2)}|${description.trim().toUpperCase()}|${ref.trim()}`)
    .digest("hex");
