import { describe, expect, it } from "vitest";
import { buildPresentationDemoCsv, presentationDemoRecordCount } from "./presentationDemo";

describe("presentation demo data", () => {
  it("creates a labelled CSV with enough fictional records for numeric-context training", () => {
    const csv = buildPresentationDemoCsv();
    expect(presentationDemoRecordCount).toBeGreaterThanOrEqual(20);
    expect(csv.split("\n")).toHaveLength(presentationDemoRecordCount + 1);
    expect(csv).toContain("MPL-OD-105");
    expect(csv).toContain("project_code,title,description");
  });
});
