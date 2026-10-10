import { describe, expect, it } from "vitest";
import { parseStatementCsv } from "@/lib/csv";
import { txnHash } from "@/lib/hash";
import { categorise, merchantKeyword } from "@/lib/categorise";

const H = "date,account,description,amount,type,ref\n";
const codes = ["HDFC-SAV", "CC-1"];

describe("parseStatementCsv", () => {
  it("parses a good row", () => {
    const { ok, bad } = parseStatementCsv(H + "2026-09-03,HDFC-SAV,SWIGGY BANGALORE,-450.00,DEBIT,UPI1\n", codes);
    expect(bad).toEqual([]);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toMatchObject({ line: 2, date: "2026-09-03", account: "HDFC-SAV", amount: -450, type: "DEBIT", ref: "UPI1" });
    expect(ok[0].hash).toHaveLength(64);
  });

  it("rejects bad date", () => {
    const { ok, bad } = parseStatementCsv(H + "03/09/2026,HDFC-SAV,X,-1,DEBIT,\n", codes);
    expect(ok).toHaveLength(0);
    expect(bad[0]).toMatchObject({ line: 2 });
    expect(bad[0].reason).toMatch(/date/);
  });

  it("rejects sign/type mismatch", () => {
    const { bad } = parseStatementCsv(H + "2026-09-03,HDFC-SAV,X,-1,CREDIT,\n", codes);
    expect(bad[0].reason).toMatch(/disagrees/);
  });

  it("rejects unknown account", () => {
    const { bad } = parseStatementCsv(H + "2026-09-03,SBI-SAV,X,-1,DEBIT,\n", codes);
    expect(bad[0].reason).toMatch(/unknown account/);
  });

  it("same row twice gives same hash", () => {
    const row = "2026-09-03,HDFC-SAV,SWIGGY BANGALORE,-450.00,DEBIT,\n";
    const { ok } = parseStatementCsv(H + row + row, codes);
    expect(ok[0].hash).toBe(ok[1].hash);
    expect(txnHash("HDFC-SAV", "2026-09-03", -450, " swiggy bangalore ")).toBe(ok[0].hash);
    expect(txnHash("HDFC-SAV", "2026-09-03", -450, "swiggy bangalore", "UPI2")).not.toBe(ok[0].hash);
  });
});

describe("categorise", () => {
  const fb = { transferId: 15 };
  it("matches a rule", () => {
    expect(categorise("SWIGGY BANGALORE", -450, [{ keyword: "swiggy", categoryId: 1 }], fb)).toBe(1);
  });
  it("leaves unmatched credits uncategorised (no Income guess)", () => {
    expect(categorise("UPI/123/UPI/friend@ybl", 5000, [], fb)).toBeNull();
  });
  it("falls back to transfer for card payments", () => {
    expect(categorise("HDFC CREDIT CARD PAYMENT", -5000, [], fb)).toBe(15);
  });
  it("returns null otherwise", () => {
    expect(categorise("RANDOM", -10, [], fb)).toBeNull();
  });
  it("longest matching keyword wins", () => {
    const rules = [{ keyword: "jane d", categoryId: 15 }, { keyword: "jane doe fd", categoryId: 20 }];
    expect(categorise("FD 103 JANE DOE FD", -50000, rules, fb)).toBe(20);
    expect(categorise("UPI/DR/1/Jane D/BARB", -500, rules, fb)).toBe(15);
  });
  it("reimbursement rules only claim money coming in", () => {
    const rules = [{ keyword: "friend@", categoryId: 16 }];
    const withR = { ...fb, reimbursementId: 16 };
    expect(categorise("UPI/friend@ybl", 500, rules, withR)).toBe(16);
    expect(categorise("UPI/friend@ybl", -500, rules, withR)).toBeNull(); // paying the friend is still spending
  });
});

describe("merchantKeyword", () => {
  it("strips bank noise", () => expect(merchantKeyword("UPI-DR-12345-SWIGGY BANGALORE")).toBe("swiggy bangalore"));
  it("rejects too-short keywords", () => expect(merchantKeyword("OLA")).toBe(""));
  it("keeps plain merchants", () => expect(merchantKeyword("NETFLIX")).toBe("netflix"));
  it("uses the UPI id so phone-number payees stay distinct", () => {
    expect(merchantKeyword("UPI/538053038257/16:20:20/UPI/9850828135@ybl/Paym")).toBe("9850828135@");
    expect(merchantKeyword("UPI/1/UPI/cred.club@axisb/pay")).toBe("cred.club@");
  });
});
