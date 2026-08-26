import { describe, expect, it } from "vitest";
import { runAllDetectors } from "./detectors";
import { validateProjectRows } from "./importValidation";
import { seedProjects, seedVendors } from "./seed";

const vendorIdByCode = new Map(seedVendors.map((vendor, index) => [vendor.vendorCode, index + 1]));

function demoProjects() {
  return seedProjects.map((project, index) => ({
    ...project,
    id: index + 1,
    vendorId: vendorIdByCode.get(project.vendorCode) ?? null,
    vendorName: seedVendors.find(vendor => vendor.vendorCode === project.vendorCode)?.name ?? null,
    sanctionDate: new Date(project.sanctionDate),
    expectedCompletionDate: new Date(project.expectedCompletionDate),
    lastUpdateDate: new Date(project.lastUpdateDate),
  }));
}

describe("explainable audit detectors", () => {
  it("produces reviewable alerts for each deliberately seeded pattern", () => {
    const results = runAllDetectors(demoProjects(), new Date("2026-08-26T00:00:00.000Z"));

    expect(results.some(result => result.riskType === "cost_outlier" && result.projectCode === "MPL-OD-105")).toBe(true);
    expect(results.some(result => result.riskType === "duplicate_work" && result.projectCode === "MPL-MH-202")).toBe(true);
    expect(results.some(result => result.riskType === "vendor_concentration" && result.projectCode === "MPL-AS-301")).toBe(true);
    expect(results.some(result => result.riskType === "stalled_project" && result.projectCode === "MPL-RJ-401")).toBe(true);
    expect(results.some(result => result.riskType === "data_quality" && result.projectCode === "MPL-OD-106")).toBe(true);

    results.forEach(result => {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.rationale.length).toBeGreaterThan(20);
    });
  });
});

describe("CSV project validation", () => {
  it("separates blocking errors from non-blocking data-quality warnings", () => {
    const valid = seedProjects[0]!;
    const rows = [
      {
        projectCode: valid.projectCode, title: valid.title, description: "", category: valid.category, state: valid.state, district: valid.district, locality: valid.locality, latitude: "", longitude: "", vendorName: "Import Test Vendor", financialYear: valid.financialYear, sanctionedAmount: String(valid.sanctionedAmount), estimatedAmount: "", actualExpenditure: String(valid.actualExpenditure), sanctionDate: valid.sanctionDate, expectedCompletionDate: valid.expectedCompletionDate, lastUpdateDate: valid.lastUpdateDate, progressPercent: String(valid.progressPercent), status: valid.status,
      },
      {
        projectCode: valid.projectCode, title: "Invalid duplicate", description: "", category: valid.category, state: valid.state, district: valid.district, locality: valid.locality, latitude: "", longitude: "", vendorName: "Import Test Vendor", financialYear: valid.financialYear, sanctionedAmount: "-1", estimatedAmount: "", actualExpenditure: "-3", sanctionDate: "not-a-date", expectedCompletionDate: valid.expectedCompletionDate, lastUpdateDate: valid.lastUpdateDate, progressPercent: "121", status: "unknown",
      },
    ];
    const result = validateProjectRows(rows);

    expect(result.accepted).toHaveLength(1);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues.some(issue => issue.field === "projectCode" && issue.severity === "error")).toBe(true);
  });
});
