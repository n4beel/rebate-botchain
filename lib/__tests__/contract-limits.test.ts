import { describe, it, expect } from "vitest";
import { BOTCHAIN_ABI } from "../botchain/abi";

describe("Rebate ABI checks", () => {
  it("includes all required methods", () => {
    const fnNames = BOTCHAIN_ABI.filter((x) => x.type === "function").map((x: any) => x.name);
    expect(fnNames).toContain("list");
    expect(fnNames).toContain("setPrice");
    expect(fnNames).toContain("buy");
    expect(fnNames).toContain("settle");
    expect(fnNames).toContain("withdraw");
    expect(fnNames).toContain("listingOf");
    expect(fnNames).toContain("changesOf");
    expect(fnNames).toContain("purchaseOf");
    expect(fnNames).toContain("refundDue");
    expect(fnNames).toContain("purchasesOf");
    expect(fnNames).toContain("purchasesBy");
    expect(fnNames).toContain("latest");
    expect(fnNames).toContain("pending");
    expect(fnNames).toContain("listingCount");
    expect(fnNames).toContain("purchaseCount");
  });

  it("includes all required events", () => {
    const eventNames = BOTCHAIN_ABI.filter((x) => x.type === "event").map((x: any) => x.name);
    expect(eventNames).toContain("Listed");
    expect(eventNames).toContain("PriceChanged");
    expect(eventNames).toContain("Bought");
    expect(eventNames).toContain("Settled");
    expect(eventNames).toContain("Withdrawn");
  });
});
