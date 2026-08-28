import { describe, expect, it } from "vitest";
import { fetchOfficialAllocationCsv, isOfficialAllocationCsv, officialAllocationAssetUrl } from "./officialAllocation";

describe("official allocation source", () => {
  it("accepts the expected official allocation header from the packaged public source", async () => {
    const csv = await fetchOfficialAllocationCsv(async () => new Response("State,Hon'ble Members of Parliaments,Constituency,Allocated AMOUNT ( ₹ )\nOdisha,Example MP,Example Constituency,147000000", { status: 200 }));
    expect(csv).toContain("Allocated AMOUNT");
    expect(officialAllocationAssetUrl).toContain("/manus-storage/");
  });

  it("rejects an unexpected or unavailable packaged source", async () => {
    await expect(fetchOfficialAllocationCsv(async () => new Response("not a csv", { status: 200 }))).rejects.toThrow("does not match");
  });

  it("recognises the user-supplied allocated-limit export header before it is sent to the allocation workflow", () => {
    expect(isOfficialAllocationCsv("\ufeff\"Sr. No.\",State,Hon'ble Members of Parliaments,Constituency,Allocated AMOUNT ( ₹ )\n1,Odisha,Example MP,Example Constituency,147000000")).toBe(true);
    expect(isOfficialAllocationCsv("project_code,title,sanctioned_amount")).toBe(false);
  });
});
