import { apiUrl } from "./api";

export type GuardianUser = { id: number; name: string; email: string; role: string };
export type GuardianProject = { id: number; project_code: string; title: string; category: string; state: string; district: string; vendor_name?: string; progress_percent: number; project_status: string; sanctioned_amount: number; actual_expenditure: number };
export type GuardianAlert = { id: number; risk_type: string; risk_score: number; risk_band: string; alert_status: string; title: string; rationale: string; project: { code: string; title: string } };
export type CsvIssue = { row: string; field?: string; severity: "error" | "warning"; message: string };
export type AllocationRecord = { id: number; context_band: string; model_score: number; variance_direction: string; state_peer_count: number; state_peer_median: number; applied_variance_percent: number; record: { state: string; mp_name: string; constituency: string; allocated_amount: number } };
export type AllocationDashboard = { model: { model_code: string; model_version: string; methodology: string }; source: { source_url: string; source_scope: string; row_count: number }; kpis: { record_count: number; state_count: number; high_variance_count: number; median_allocation: number }; records: AllocationRecord[] };

export async function guardianRequest<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) };
  if (!(init?.body instanceof FormData)) Object.assign(headers, { "Content-Type": "application/json" });
  const response = await fetch(apiUrl(path), { ...init, credentials: "include", headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || "Request failed.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function formatMoney(value: number) {
  return `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 }).format(value || 0)}`;
}

export function humanise(value: string) {
  return value.replaceAll("_", " ");
}

export function formatSemanticSimilarity(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
