import { describe, expect, it } from "vitest";
import { categorise, matches, merchantKeyword, payer } from "@/lib/categorise";

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

describe("payer", () => {
  it("pulls a readable sender out of common narrations", () => {
    expect(payer("NEFT-SCBLH18100732200-ACME SOFTWARE PRIVATE")).toBe("ACME SOFTWARE PRIVATE");
    expect(payer("NEFT/IN22618141096085/ACME TECH PRIVATE LIM")).toBe("ACME TECH PRIVATE LIM");
    expect(payer("UPI/906141600420/13:10:13/UPI/9000000001@ybl/Paym")).toBe("9000000001@ybl");
    expect(payer("UPI/CR/623988542595/Rahul K/SBIN/rahulk/UPI")).toBe("Rahul K");
    expect(payer("MONTHLY INTEREST CREDIT")).toBe("MONTHLY INTEREST CREDIT");
  });
});

describe("payer on card and bank spends", () => {
  it("names the merchant", () => {
    expect(payer("UPI/AMUL/PAYTMQR644A7V@PTYS/1234@PTYES")).toBe("AMUL");
    expect(payer("FLIPKART INTERNET PVT,NOIDA")).toBe("FLIPKART INTERNET PVT");
    expect(payer("UPI/DR/609836638679/RAHUL K/SBIN/rahulk/Sent")).toBe("RAHUL K");
    expect(payer("IMPS/P2A/534583447040/ACMEBROKING/20251211f249")).toBe("ACMEBROKING");
  });
});
