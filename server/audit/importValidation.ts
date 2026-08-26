import type { CsvProjectRow } from "../../shared/audit";

export type ValidationIssue = {
  rowNumber: number;
  field: string;
  severity: "warning" | "error";
  message: string;
};

export type ValidatedProjectRow = {
  projectCode: string;
  title: string;
  description: string;
  category: string;
  state: string;
  district: string;
  locality: string;
  latitude: number | null;
  longitude: number | null;
  vendorName: string;
  financialYear: string;
  sanctionedAmount: number;
  estimatedAmount: number | null;
  actualExpenditure: number;
  sanctionDate: Date;
  expectedCompletionDate: Date;
  lastUpdateDate: Date;
  progressPercent: number;
  status: "planning" | "ongoing" | "completed" | "on_hold" | "cancelled";
};

const statuses = new Set(["planning", "ongoing", "completed", "on_hold", "cancelled"]);
const requiredFields: Array<keyof CsvProjectRow> = ["projectCode", "title", "category", "state", "district", "locality", "vendorName", "financialYear", "sanctionedAmount", "actualExpenditure", "sanctionDate", "expectedCompletionDate", "lastUpdateDate", "progressPercent", "status"];

const parseNumber = (value: string | undefined) => {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: string | undefined) => {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function validateProjectRows(rows: CsvProjectRow[]) {
  const issues: ValidationIssue[] = [];
  const accepted: ValidatedProjectRow[] = [];
  const seenCodes = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    let hasError = false;
    requiredFields.forEach(field => {
      if (!row[field]?.trim()) {
        issues.push({ rowNumber, field, severity: "error", message: `${field} is required.` });
        hasError = true;
      }
    });
    const projectCode = row.projectCode?.trim();
    if (projectCode && seenCodes.has(projectCode)) {
      issues.push({ rowNumber, field: "projectCode", severity: "error", message: "Project code must be unique within the import." });
      hasError = true;
    }
    if (projectCode) seenCodes.add(projectCode);
    const sanctionedAmount = parseNumber(row.sanctionedAmount);
    const actualExpenditure = parseNumber(row.actualExpenditure);
    const estimatedAmount = parseNumber(row.estimatedAmount);
    const progressPercent = parseNumber(row.progressPercent);
    const latitude = parseNumber(row.latitude);
    const longitude = parseNumber(row.longitude);
    const sanctionDate = parseDate(row.sanctionDate);
    const expectedCompletionDate = parseDate(row.expectedCompletionDate);
    const lastUpdateDate = parseDate(row.lastUpdateDate);
    if (sanctionedAmount === null || sanctionedAmount <= 0) { issues.push({ rowNumber, field: "sanctionedAmount", severity: "error", message: "Sanctioned amount must be a positive number." }); hasError = true; }
    if (actualExpenditure === null || actualExpenditure < 0) { issues.push({ rowNumber, field: "actualExpenditure", severity: "error", message: "Actual expenditure must be zero or greater." }); hasError = true; }
    if (progressPercent === null || progressPercent < 0 || progressPercent > 100) { issues.push({ rowNumber, field: "progressPercent", severity: "error", message: "Progress must be between 0 and 100." }); hasError = true; }
    if (!sanctionDate || !expectedCompletionDate || !lastUpdateDate) { issues.push({ rowNumber, field: "dates", severity: "error", message: "Sanction, expected completion, and last update must be valid dates." }); hasError = true; }
    if (!statuses.has(row.status?.trim().toLowerCase())) { issues.push({ rowNumber, field: "status", severity: "error", message: "Status must be planning, ongoing, completed, on_hold, or cancelled." }); hasError = true; }
    if (latitude === null || longitude === null) issues.push({ rowNumber, field: "coordinates", severity: "warning", message: "Coordinates are missing; distance evidence cannot be calculated." });
    if (!row.description?.trim()) issues.push({ rowNumber, field: "description", severity: "warning", message: "Description is missing; duplicate-work text evidence will be weaker." });
    if (estimatedAmount === null) issues.push({ rowNumber, field: "estimatedAmount", severity: "warning", message: "Estimated amount is missing; budget-variance context is unavailable." });
    if (sanctionDate && expectedCompletionDate && expectedCompletionDate <= sanctionDate) issues.push({ rowNumber, field: "expectedCompletionDate", severity: "warning", message: "Expected completion is not after sanction date." });
    if (sanctionedAmount !== null && actualExpenditure !== null && actualExpenditure > sanctionedAmount * 1.05) issues.push({ rowNumber, field: "actualExpenditure", severity: "warning", message: "Expenditure exceeds sanction by more than 5%; it will be flagged for review." });
    if (hasError || !projectCode || sanctionedAmount === null || actualExpenditure === null || progressPercent === null || !sanctionDate || !expectedCompletionDate || !lastUpdateDate) return;
    accepted.push({
      projectCode,
      title: row.title.trim(), description: row.description?.trim() ?? "", category: row.category.trim(), state: row.state.trim(), district: row.district.trim(), locality: row.locality.trim(),
      latitude, longitude, vendorName: row.vendorName.trim(), financialYear: row.financialYear.trim(), sanctionedAmount, estimatedAmount, actualExpenditure,
      sanctionDate, expectedCompletionDate, lastUpdateDate, progressPercent: Math.round(progressPercent), status: row.status.trim().toLowerCase() as ValidatedProjectRow["status"],
    });
  });
  return { accepted, issues, errorCount: issues.filter(issue => issue.severity === "error").length, warningCount: issues.filter(issue => issue.severity === "warning").length };
}
