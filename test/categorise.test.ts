import { describe, expect, it } from "vitest";
import { categorise, matches, merchantKeyword } from "@/lib/categorise";

describe("rule matching", () => {
  it("a keyword saved from a row matches that row again", () => {
    for (const d of ["UPI/DR/111111111111/RAHUL K/SBIN/rahulk/Sent", "ACHDR/TP ACH ACMEINS/2222222222/1", "ACMEINS,MUMBAI"])
      expect(matches(d, merchantKeyword(d))).toBe(true);
  });
  it("raw substring still works (UPI ids keep digits)", () => {
    expect(categorise("UPI/1/UPI/9000000001@ybl/Paym", -5, [{ keyword: "9000000001@", categoryId: 7 }], { transferId: 1 })).toBe(7);
  });
  it("no false hit across words", () => {
    expect(matches("CHOCOLATE ROOM", "ola cabs")).toBe(false);
  });
});
