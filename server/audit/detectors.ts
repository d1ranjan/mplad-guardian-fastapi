import type { DetectorResult, RiskBand, RiskType } from "../../shared/audit";

export type AuditProject = {
  id: number;
  projectCode: string;
  title: string;
  description: string | null;
  category: string;
  state: string;
  district: string;
  locality: string;
  latitude: number | null;
  longitude: number | null;
  vendorId: number | null;
  vendorName: string | null;
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

export type AuditableDetectorResult = DetectorResult & { projectCode: string };

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const percent = (value: number) => `${Math.round(value)}%`;
const clamp = (value: number, lower = 0, upper = 100) => Math.max(lower, Math.min(upper, Math.round(value)));

export function riskBand(score: number): RiskBand {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint]! : (sorted[midpoint - 1]! + sorted[midpoint]!) / 2;
}

function normaliseText(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(the|a|an|at|for|near|and|of|in|to|with|on)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(left: string, right: string) {
  const a = new Set(normaliseText(left).split(" ").filter(token => token.length > 2));
  const b = new Set(normaliseText(right).split(" ").filter(token => token.length > 2));
  const shared = Array.from(a).filter(token => b.has(token)).length;
  const unionTokens = new Set<string>();
  a.forEach(token => unionTokens.add(token));
  b.forEach(token => unionTokens.add(token));
  const union = unionTokens.size;
  return union === 0 ? 0 : shared / union;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function makeResult(
  projectCode: string,
  riskType: RiskType,
  score: number,
  title: string,
  rationale: string,
  evidence: DetectorResult["evidence"],
  linkedProjectCodes: string[] = [],
): AuditableDetectorResult {
  const finalScore = clamp(score);
  return { projectCode, riskType, score: finalScore, riskBand: riskBand(finalScore), title, rationale, evidence, linkedProjectCodes };
}

export function detectCostOutliers(projects: AuditProject[]): AuditableDetectorResult[] {
  return projects.flatMap(project => {
    const peers = projects.filter(candidate =>
      candidate.projectCode !== project.projectCode &&
      candidate.category === project.category &&
      candidate.state === project.state &&
      candidate.financialYear === project.financialYear &&
      candidate.actualExpenditure > 0,
    );
    if (peers.length < 3 || project.actualExpenditure <= 0) return [];
    const benchmark = median(peers.map(peer => peer.actualExpenditure));
    const deviation = (project.actualExpenditure - benchmark) / benchmark;
    if (deviation < 0.55) return [];
    const score = 44 + deviation * 32 + Math.min(peers.length, 8) * 2;
    return [makeResult(
      project.projectCode,
      "cost_outlier",
      score,
      "Cost substantially exceeds comparable peer projects",
      `${money(project.actualExpenditure)} actual expenditure is ${percent(deviation * 100)} above the median of comparable ${project.category.toLowerCase()} projects in ${project.state} for ${project.financialYear}.`,
      [
        { metric: "actual_expenditure", label: "Actual expenditure", value: money(project.actualExpenditure), unit: "INR", description: "Recorded expenditure for this project." },
        { metric: "peer_median", label: "Comparable peer median", value: money(benchmark), unit: "INR", description: "Median actual expenditure for same category, state, and financial-year peers." },
        { metric: "cost_deviation", label: "Deviation from peer median", value: percent(deviation * 100), benchmark: "Review threshold: 55%", description: "Relative variance from the comparable peer median." },
        { metric: "peer_count", label: "Comparable projects", value: peers.length, description: "Number of projects contributing to the peer benchmark." },
      ],
      peers.slice(0, 5).map(peer => peer.projectCode),
    )];
  });
}

export function detectDuplicateWork(projects: AuditProject[]): AuditableDetectorResult[] {
  const seenPairs = new Set<string>();
  const results: AuditableDetectorResult[] = [];
  for (const project of projects) {
    for (const candidate of projects) {
      if (project.id === candidate.id || project.district !== candidate.district || project.category !== candidate.category) continue;
      const pairKey = [project.projectCode, candidate.projectCode].sort().join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const combinedProjectText = `${project.title} ${project.description ?? ""}`;
      const combinedCandidateText = `${candidate.title} ${candidate.description ?? ""}`;
      const textScore = similarity(combinedProjectText, combinedCandidateText);
      const sameLocality = normaliseText(project.locality) === normaliseText(candidate.locality);
      const distance = project.latitude !== null && project.longitude !== null && candidate.latitude !== null && candidate.longitude !== null
        ? haversineKm(project.latitude, project.longitude, candidate.latitude, candidate.longitude)
        : null;
      const dateGap = Math.abs(daysBetween(project.sanctionDate, candidate.sanctionDate));
      const proximitySignal = sameLocality || (distance !== null && distance < 1.5);
      if (textScore < 0.4 || !proximitySignal || dateGap > 900) continue;
      const newer = project.sanctionDate.getTime() >= candidate.sanctionDate.getTime() ? project : candidate;
      const older = newer.projectCode === project.projectCode ? candidate : project;
      const score = 42 + textScore * 38 + (sameLocality ? 12 : 0) + (distance !== null && distance < 0.5 ? 10 : 0);
      results.push(makeResult(
        newer.projectCode,
        "duplicate_work",
        score,
        "Potentially overlapping work identified",
        `The project description is ${percent(textScore * 100)} similar to ${older.projectCode} and both records point to ${sameLocality ? "the same locality" : "nearby locations"} within a reviewable time window.`,
        [
          { metric: "text_similarity", label: "Normalised text similarity", value: percent(textScore * 100), benchmark: "Review threshold: 40%", description: "Token overlap after normalising titles and descriptions." },
          { metric: "locality_match", label: "Locality signal", value: sameLocality ? "Exact locality match" : "Nearby locality", description: "The locality comparison signal supporting the case." },
          { metric: "distance_km", label: "Coordinate distance", value: distance === null ? "Not available" : `${distance.toFixed(2)} km`, benchmark: "Review threshold: 1.50 km", description: "Great-circle distance between recorded project coordinates." },
          { metric: "date_gap_days", label: "Sanction date gap", value: `${dateGap} days`, benchmark: "Review window: 900 days", description: "Absolute difference between sanction dates." },
        ],
        [older.projectCode],
      ));
    }
  }
  return results;
}

export function detectVendorConcentration(projects: AuditProject[]): AuditableDetectorResult[] {
  const results: AuditableDetectorResult[] = [];
  const cohorts = new Map<string, AuditProject[]>();
  projects.forEach(project => {
    if (!project.vendorId) return;
    const key = [project.state, project.district, project.financialYear, project.category].join("|");
    cohorts.set(key, [...(cohorts.get(key) ?? []), project]);
  });
  cohorts.forEach(cohort => {
    if (cohort.length < 4) return;
    const vendorGroups = new Map<number, AuditProject[]>();
    cohort.forEach(project => vendorGroups.set(project.vendorId!, [...(vendorGroups.get(project.vendorId!) ?? []), project]));
    const totalValue = cohort.reduce((sum, project) => sum + project.sanctionedAmount, 0);
    const hhi = Array.from(vendorGroups.values()).reduce((sum, group) => sum + (group.length / cohort.length) ** 2, 0) * 10_000;
    vendorGroups.forEach(group => {
      const projectShare = group.length / cohort.length;
      const valueShare = group.reduce((sum, project) => sum + project.sanctionedAmount, 0) / totalValue;
      if (projectShare < 0.6) return;
      const focal = [...group].sort((a, b) => a.sanctionDate.getTime() - b.sanctionDate.getTime())[0]!;
      results.push(makeResult(
        focal.projectCode,
        "vendor_concentration",
        38 + projectShare * 36 + valueShare * 22 + (hhi > 2500 ? 8 : 0),
        "Vendor concentration warrants review",
        `${focal.vendorName ?? "The vendor"} received ${group.length} of ${cohort.length} comparable projects, representing ${percent(projectShare * 100)} of projects and ${percent(valueShare * 100)} of sanctioned value in the cohort.`,
        [
          { metric: "vendor_project_share", label: "Vendor project share", value: percent(projectShare * 100), benchmark: "Review threshold: 60%", description: "Share of projects awarded to the vendor within the comparison cohort." },
          { metric: "vendor_value_share", label: "Vendor sanctioned-value share", value: percent(valueShare * 100), description: "Share of sanctioned value represented by this vendor's projects." },
          { metric: "hhi", label: "Cohort concentration (HHI)", value: Math.round(hhi), benchmark: "High concentration: > 2,500", description: "Herfindahl–Hirschman Index based on project-count shares." },
          { metric: "cohort_count", label: "Comparable projects", value: cohort.length, description: "Same state, district, financial year, and category." },
        ],
        group.filter(project => project.projectCode !== focal.projectCode).map(project => project.projectCode),
      ));
    });
  });
  return results;
}

export function detectStalledProjects(projects: AuditProject[], referenceDate = new Date()): AuditableDetectorResult[] {
  return projects.flatMap(project => {
    if (project.status === "completed" || project.status === "cancelled") return [];
    const daysOverdue = daysBetween(project.expectedCompletionDate, referenceDate);
    const daysSinceUpdate = daysBetween(project.lastUpdateDate, referenceDate);
    const expenditureRatio = project.sanctionedAmount > 0 ? project.actualExpenditure / project.sanctionedAmount : 0;
    if (daysOverdue < 90 || project.progressPercent >= 90 || daysSinceUpdate < 60) return [];
    const score = 42 + Math.min(daysOverdue / 10, 35) + Math.min(daysSinceUpdate / 20, 15) + (project.progressPercent < 50 ? 12 : 0) + (expenditureRatio > 0.4 ? 8 : 0);
    return [makeResult(
      project.projectCode,
      "stalled_project",
      score,
      "Project appears delayed and stale",
      `The project is ${daysOverdue} days beyond its expected completion date, remains ${percent(project.progressPercent)} complete, and has no recorded update for ${daysSinceUpdate} days.`,
      [
        { metric: "days_overdue", label: "Days beyond expected completion", value: daysOverdue, benchmark: "Review threshold: 90 days", unit: "days", description: "Elapsed days since the expected completion date." },
        { metric: "progress_percent", label: "Reported progress", value: percent(project.progressPercent), benchmark: "Completion threshold: 90%", description: "Last recorded physical-progress percentage." },
        { metric: "days_since_update", label: "Days since last update", value: daysSinceUpdate, benchmark: "Staleness threshold: 60 days", unit: "days", description: "Age of the latest project update." },
        { metric: "expenditure_ratio", label: "Expenditure released", value: percent(expenditureRatio * 100), description: "Actual expenditure as a share of sanctioned value." },
      ],
    )];
  });
}

export function detectDataQualityIssues(projects: AuditProject[]): AuditableDetectorResult[] {
  return projects.flatMap(project => {
    const issues: DetectorResult["evidence"] = [];
    if (project.actualExpenditure > project.sanctionedAmount * 1.05) {
      issues.push({ metric: "expenditure_exceeds_sanction", label: "Expenditure exceeds sanction", value: money(project.actualExpenditure), benchmark: money(project.sanctionedAmount), unit: "INR", description: "Recorded expenditure exceeds sanctioned amount by more than 5%." });
    }
    if (project.lastUpdateDate.getTime() < project.sanctionDate.getTime()) {
      issues.push({ metric: "update_before_sanction", label: "Update precedes sanction", value: project.lastUpdateDate.toISOString().slice(0, 10), benchmark: project.sanctionDate.toISOString().slice(0, 10), description: "The last update date occurs before the sanction date." });
    }
    if (project.status === "completed" && project.progressPercent < 95) {
      issues.push({ metric: "completion_progress_mismatch", label: "Completion status mismatch", value: percent(project.progressPercent), benchmark: "Completed requires ≥95%", description: "Status is completed but reported progress is below the completion threshold." });
    }
    if (!issues.length) return [];
    return [makeResult(
      project.projectCode,
      "data_quality",
      40 + issues.length * 18,
      "Source-record quality exception",
      `${issues.length} source-data condition${issues.length === 1 ? " requires" : "s require"} review before relying on this record for decision-making.`,
      issues,
    )];
  });
}

export function runAllDetectors(projects: AuditProject[], referenceDate = new Date()) {
  return [
    ...detectCostOutliers(projects),
    ...detectDuplicateWork(projects),
    ...detectVendorConcentration(projects),
    ...detectStalledProjects(projects, referenceDate),
    ...detectDataQualityIssues(projects),
  ];
}
