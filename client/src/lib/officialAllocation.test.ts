import { describe, expect, it } from "vitest";
import { fetchOfficialAllocationCsv, officialAllocationAssetUrl } from "./officialAllocation";

describe("official allocation source", () => {
  it("accepts the expected official allocation header from the packaged public source", async () => {
    const csv = await fetchOfficialAllocationCsv(async () => new Response("State,Allocated AMOUNT ( ₹ )\nOdisha,147000000", { status: 200 }));
    expect(csv).toContain("Allocated AMOUNT");
    expect(officialAllocationAssetUrl).toContain("/manus-storage/");
  });

  it("rejects an unexpected or unavailable packaged source", async () => {
    await expect(fetchOfficialAllocationCsv(async () => new Response("not a csv", { status: 200 }))).rejects.toThrow("does not match");
  });
});
