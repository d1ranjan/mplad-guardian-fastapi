import { describe, expect, it } from "vitest";
import { highestRiskScore } from "./riskAggregation";

describe("risk-priority aggregation", () => {
  it("returns the highest persisted alert score for a project", () => {
    expect(highestRiskScore([{ riskScore: 48 }, { riskScore: 91 }, { riskScore: 67 }])).toBe(91);
  });

  it("returns zero when a project has no linked alerts", () => {
    expect(highestRiskScore([])).toBe(0);
  });
});
