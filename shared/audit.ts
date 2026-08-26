export const RISK_TYPES = [
  "cost_outlier",
  "duplicate_work",
  "vendor_concentration",
  "stalled_project",
  "data_quality",
] as const;

export type RiskType = (typeof RISK_TYPES)[number];

export const ALERT_STATUSES = [
  "open",
  "field_verification",
  "dismissed",
  "resolved",
] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

export type RiskBand = "critical" | "high" | "moderate" | "low";

export type DetectorEvidence = {
  metric: string;
  label: string;
  value: string | number;
  benchmark?: string | number;
  unit?: string;
  description: string;
};

export type DetectorResult = {
  riskType: RiskType;
  score: number;
  riskBand: RiskBand;
  title: string;
  rationale: string;
  evidence: DetectorEvidence[];
  linkedProjectCodes?: string[];
};

export type CsvProjectRow = {
  projectCode: string;
  title: string;
  description?: string;
  category: string;
  state: string;
  district: string;
  locality: string;
  latitude?: string;
  longitude?: string;
  vendorName: string;
  financialYear: string;
  sanctionedAmount: string;
  estimatedAmount?: string;
  actualExpenditure: string;
  sanctionDate: string;
  expectedCompletionDate: string;
  lastUpdateDate: string;
  progressPercent: string;
  status: string;
};

export const PROJECT_IMPORT_HEADERS = [
  "projectCode",
  "title",
  "description",
  "category",
  "state",
  "district",
  "locality",
  "latitude",
  "longitude",
  "vendorName",
  "financialYear",
  "sanctionedAmount",
  "estimatedAmount",
  "actualExpenditure",
  "sanctionDate",
  "expectedCompletionDate",
  "lastUpdateDate",
  "progressPercent",
  "status",
] as const;
