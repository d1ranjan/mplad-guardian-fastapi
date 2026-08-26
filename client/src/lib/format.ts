export const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
export const compactMoney = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(value);
export const dateLabel = (value: Date | string | null | undefined) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";

export const riskLabel: Record<string, string> = {
  cost_outlier: "Cost outlier", duplicate_work: "Potential duplicate", vendor_concentration: "Vendor concentration", stalled_project: "Stalled project", data_quality: "Data quality",
};

export const riskTone: Record<string, string> = {
  critical: "bg-rose-100 text-rose-800 border-rose-200", high: "bg-amber-100 text-amber-800 border-amber-200", moderate: "bg-sky-100 text-sky-800 border-sky-200", low: "bg-slate-100 text-slate-700 border-slate-200",
};

export const statusLabel: Record<string, string> = {
  open: "Open", field_verification: "Field verification", dismissed: "Dismissed", resolved: "Resolved",
};

export const statusTone: Record<string, string> = {
  open: "bg-rose-50 text-rose-700 border-rose-100", field_verification: "bg-violet-50 text-violet-700 border-violet-100", dismissed: "bg-slate-100 text-slate-600 border-slate-200", resolved: "bg-emerald-50 text-emerald-700 border-emerald-100",
};
