import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  alertEvidence,
  alertLinks,
  auditAlerts,
  auditRuns,
  dataImports,
  dataQualityIssues,
  financialMilestones,
  projects,
  reviewerActions,
  vendors,
} from "../../drizzle/schema";
import type { CsvProjectRow } from "../../shared/audit";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { runAllDetectors, type AuditProject } from "./detectors";
import { validateProjectRows } from "./importValidation";
import { normaliseReviewNote, statusForReviewAction } from "./reviewWorkflow";
import { highestRiskScore } from "./riskAggregation";
import { seedProjects, seedVendors } from "./seed";

const algorithmVersion = "guardian-explainable-v1.0";

function vendorCodeForImportedName(name: string) {
  return `IMP-${createHash("sha1").update(name.toLowerCase()).digest("hex").slice(0, 10).toUpperCase()}`;
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}

export async function seedDemoWorkspace() {
  const db = await dbOrThrow();
  const count = await db.select({ count: sql<number>`count(*)` }).from(projects);
  if (Number(count[0]?.count ?? 0) > 0) return { seeded: false, projectCount: Number(count[0]?.count ?? 0) };
  await db.insert(vendors).values(seedVendors);
  const vendorRows = await db.select().from(vendors);
  const byCode = new Map(vendorRows.map(vendor => [vendor.vendorCode, vendor.id]));
  await db.insert(projects).values(seedProjects.map((project, index) => ({
    ...project,
    vendorId: byCode.get(project.vendorCode)!,
    sanctionDate: new Date(project.sanctionDate), expectedCompletionDate: new Date(project.expectedCompletionDate), lastUpdateDate: new Date(project.lastUpdateDate), sourceRowNumber: index + 2,
  })));
  const projectRows = await db.select().from(projects);
  await db.insert(financialMilestones).values(projectRows.flatMap(project => [
    { projectId: project.id, milestoneName: "Initial release", plannedDate: project.sanctionDate, actualDate: project.sanctionDate, plannedAmount: project.sanctionedAmount * 0.4, paidAmount: project.actualExpenditure * 0.4, status: "paid" as const },
    { projectId: project.id, milestoneName: "Completion milestone", plannedDate: project.expectedCompletionDate, actualDate: project.status === "completed" ? project.lastUpdateDate : null, plannedAmount: project.sanctionedAmount * 0.6, paidAmount: project.actualExpenditure * 0.6, status: project.status === "completed" ? "paid" as const : "delayed" as const },
  ]));
  return { seeded: true, projectCount: projectRows.length };
}

export async function loadAuditProjects(): Promise<AuditProject[]> {
  const db = await dbOrThrow();
  const rows = await db.select({ project: projects, vendor: vendors }).from(projects).leftJoin(vendors, eq(projects.vendorId, vendors.id));
  return rows.map(({ project, vendor }) => ({
    ...project,
    vendorName: vendor?.name ?? null,
    status: project.status as AuditProject["status"],
  }));
}

export async function runAudit(initiatedBy?: number | null) {
  const db = await dbOrThrow();
  const auditProjects = await loadAuditProjects();
  const sourceDigest = createHash("sha256").update(JSON.stringify(auditProjects.map(project => ({ projectCode: project.projectCode, updatedAt: project.lastUpdateDate, actualExpenditure: project.actualExpenditure })))).digest("hex");
  const runCode = `RUN-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(5).toUpperCase()}`;
  const insertedRun = await db.insert(auditRuns).values({ runCode, algorithmVersion, sourceDigest, configuration: { rules: ["cost_outlier", "duplicate_work", "vendor_concentration", "stalled_project", "data_quality"] }, totalProjects: auditProjects.length, totalAlerts: 0, status: "running", initiatedBy: initiatedBy ?? null });
  const runId = Number(insertedRun[0].insertId);
  const results = runAllDetectors(auditProjects);
  const projectsByCode = new Map(auditProjects.map(project => [project.projectCode, project]));
  for (const result of results) {
    const project = projectsByCode.get(result.projectCode);
    if (!project) continue;
    const insertedAlert = await db.insert(auditAlerts).values({ auditRunId: runId, projectId: project.id, riskType: result.riskType, riskScore: result.score, riskBand: result.riskBand, alertStatus: "open", title: result.title, rationale: result.rationale, peerGroup: `${project.category} • ${project.state} • ${project.financialYear}` });
    const alertId = Number(insertedAlert[0].insertId);
    if (result.evidence.length) await db.insert(alertEvidence).values(result.evidence.map((item, index) => ({ alertId, metric: item.metric, label: item.label, valueText: String(item.value), benchmarkText: item.benchmark === undefined ? null : String(item.benchmark), unit: item.unit ?? null, description: item.description, sortOrder: index })));
    const linked = result.linkedProjectCodes?.map(code => projectsByCode.get(code)).filter((candidate): candidate is AuditProject => Boolean(candidate)) ?? [];
    if (linked.length) await db.insert(alertLinks).values(linked.map(link => ({ alertId, linkedProjectId: link.id, relation: result.riskType === "duplicate_work" ? "potential_duplicate" as const : result.riskType === "vendor_concentration" ? "vendor_peer" as const : "peer" as const })));
  }
  await db.update(auditRuns).set({ totalAlerts: results.length, status: "completed", completedAt: new Date() }).where(eq(auditRuns.id, runId));
  return { runId, runCode, totalProjects: auditProjects.length, totalAlerts: results.length };
}

export async function ensureDemoWorkspace() {
  await seedDemoWorkspace();
  const db = await dbOrThrow();
  const existingRun = await db.select().from(auditRuns).where(eq(auditRuns.status, "completed")).orderBy(desc(auditRuns.startedAt)).limit(1);
  return existingRun[0] ?? (await runAudit(null));
}

async function latestRunId() {
  const db = await dbOrThrow();
  const run = await db.select().from(auditRuns).where(eq(auditRuns.status, "completed")).orderBy(desc(auditRuns.startedAt)).limit(1);
  return run[0]?.id ?? null;
}

export async function getDashboard() {
  await ensureDemoWorkspace();
  const db = await dbOrThrow();
  const runId = await latestRunId();
  const [projectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
  const [vendorCount] = await db.select({ count: sql<number>`count(*)` }).from(vendors);
  const latestRun = runId ? (await db.select().from(auditRuns).where(eq(auditRuns.id, runId)).limit(1))[0] : null;
  const alerts = runId ? await db.select({ alert: auditAlerts, project: projects, vendor: vendors }).from(auditAlerts).innerJoin(projects, eq(auditAlerts.projectId, projects.id)).leftJoin(vendors, eq(projects.vendorId, vendors.id)).where(eq(auditAlerts.auditRunId, runId)).orderBy(desc(auditAlerts.riskScore)) : [];
  const openAlerts = alerts.filter(row => row.alert.alertStatus === "open");
  const critical = openAlerts.filter(row => row.alert.riskBand === "critical").length;
  const valueAtRisk = openAlerts.reduce((sum, row) => sum + row.project.sanctionedAmount, 0);
  const riskBreakdown = ["cost_outlier", "duplicate_work", "vendor_concentration", "stalled_project", "data_quality"].map(type => ({ type, count: openAlerts.filter(row => row.alert.riskType === type).length }));
  const statusBreakdown = ["open", "field_verification", "dismissed", "resolved"].map(status => ({ status, count: alerts.filter(row => row.alert.alertStatus === status).length }));
  return {
    latestRun,
    kpis: { projectCount: Number(projectCount?.count ?? 0), vendorCount: Number(vendorCount?.count ?? 0), openAlerts: openAlerts.length, criticalAlerts: critical, valueAtRisk },
    riskBreakdown,
    statusBreakdown,
    alerts: alerts.slice(0, 8).map(row => ({ ...row.alert, project: row.project, vendorName: row.vendor?.name ?? "Unassigned" })),
  };
}

export async function listAlerts(filters: { status?: string; riskType?: string; query?: string; minScore?: number }) {
  await ensureDemoWorkspace();
  const db = await dbOrThrow();
  const runId = await latestRunId();
  if (!runId) return [];
  const rows = await db.select({ alert: auditAlerts, project: projects, vendor: vendors }).from(auditAlerts).innerJoin(projects, eq(auditAlerts.projectId, projects.id)).leftJoin(vendors, eq(projects.vendorId, vendors.id)).where(eq(auditAlerts.auditRunId, runId)).orderBy(desc(auditAlerts.riskScore));
  const query = filters.query?.toLowerCase().trim();
  return rows.filter(({ alert, project, vendor }) => {
    if (filters.status && filters.status !== "all" && alert.alertStatus !== filters.status) return false;
    if (filters.riskType && filters.riskType !== "all" && alert.riskType !== filters.riskType) return false;
    if (filters.minScore && alert.riskScore < filters.minScore) return false;
    return !query || [project.projectCode, project.title, project.state, project.district, vendor?.name ?? "", alert.title].join(" ").toLowerCase().includes(query);
  }).map(row => ({ ...row.alert, project: row.project, vendorName: row.vendor?.name ?? "Unassigned" }));
}

export async function getAlertCase(alertId: number) {
  const db = await dbOrThrow();
  const caseRow = await db.select({ alert: auditAlerts, project: projects, vendor: vendors, run: auditRuns }).from(auditAlerts).innerJoin(projects, eq(auditAlerts.projectId, projects.id)).leftJoin(vendors, eq(projects.vendorId, vendors.id)).innerJoin(auditRuns, eq(auditAlerts.auditRunId, auditRuns.id)).where(eq(auditAlerts.id, alertId)).limit(1);
  const base = caseRow[0];
  if (!base) return null;
  const evidence = await db.select().from(alertEvidence).where(eq(alertEvidence.alertId, alertId)).orderBy(alertEvidence.sortOrder);
  const links = await db.select({ link: alertLinks, project: projects, vendor: vendors }).from(alertLinks).innerJoin(projects, eq(alertLinks.linkedProjectId, projects.id)).leftJoin(vendors, eq(projects.vendorId, vendors.id)).where(eq(alertLinks.alertId, alertId));
  const actions = await db.select().from(reviewerActions).where(eq(reviewerActions.alertId, alertId)).orderBy(desc(reviewerActions.createdAt));
  const milestones = await db.select().from(financialMilestones).where(eq(financialMilestones.projectId, base.project.id)).orderBy(financialMilestones.plannedDate);
  return { ...base.alert, project: base.project, vendor: base.vendor, auditRun: base.run, evidence, linkedProjects: links.map(row => ({ ...row.project, vendorName: row.vendor?.name ?? "Unassigned", relation: row.link.relation })), actions, milestones };
}

export async function listProjects() {
  await ensureDemoWorkspace();
  const db = await dbOrThrow();
  const runId = await latestRunId();
  const rows = await db.select({ project: projects, vendor: vendors }).from(projects).leftJoin(vendors, eq(projects.vendorId, vendors.id)).orderBy(desc(projects.updatedAt));
  const alerts = runId ? await db.select().from(auditAlerts).where(eq(auditAlerts.auditRunId, runId)) : [];
  const byProject = new Map<number, typeof alerts>();
  alerts.forEach(alert => byProject.set(alert.projectId, [...(byProject.get(alert.projectId) ?? []), alert]));
  return rows.map(row => {
    const projectAlerts = byProject.get(row.project.id) ?? [];
    return { ...row.project, vendorName: row.vendor?.name ?? "Unassigned", alertCount: projectAlerts.length, maxRiskScore: highestRiskScore(projectAlerts) };
  });
}

export async function reviewAlert(input: { alertId: number; action: "field_verification" | "dismissed" | "resolved"; note: string; reviewerId: number }) {
  const db = await dbOrThrow();
  const alertStatus = statusForReviewAction(input.action);
  await db.update(auditAlerts).set({ alertStatus }).where(eq(auditAlerts.id, input.alertId));
  await db.insert(reviewerActions).values({ alertId: input.alertId, reviewerId: input.reviewerId, action: input.action, note: normaliseReviewNote(input.note) });
  return getAlertCase(input.alertId);
}

export async function importProjectCsv(input: { filename: string; rawCsv: string; rows: CsvProjectRow[]; importedBy?: number | null }) {
  const validation = validateProjectRows(input.rows);
  if (validation.errorCount > 0) return { success: false as const, ...validation, importId: null };
  const db = await dbOrThrow();
  const checksum = createHash("sha256").update(input.rawCsv).digest("hex");
  const { key, url } = await storagePut(`imports/${Date.now()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`, input.rawCsv, "text/csv");
  const inserted = await db.insert(dataImports).values({ originalFilename: input.filename, storageKey: key, storageUrl: url, checksum, totalRows: input.rows.length, acceptedRows: validation.accepted.length, warningCount: validation.warningCount, errorCount: validation.errorCount, importStatus: "validated", importedBy: input.importedBy ?? null });
  const importId = Number(inserted[0].insertId);
  const vendorNameLookup: Record<string, string> = {};
  validation.accepted.forEach(row => {
    vendorNameLookup[row.vendorName.toLowerCase()] = row.vendorName;
  });
  const vendorNames = Object.keys(vendorNameLookup).map(key => vendorNameLookup[key]!);
  const existingVendors = await db.select().from(vendors).where(inArray(vendors.name, vendorNames));
  const vendorMap = new Map(existingVendors.map(vendor => [vendor.name.toLowerCase(), vendor.id]));
  const newVendors = vendorNames.filter(name => !vendorMap.has(name.toLowerCase())).map(name => ({ vendorCode: vendorCodeForImportedName(name), name, state: validation.accepted.find(row => row.vendorName === name)?.state ?? "Unknown", vendorType: "Imported vendor" }));
  if (newVendors.length) await db.insert(vendors).values(newVendors);
  const resolvedVendors = await db.select().from(vendors).where(inArray(vendors.name, vendorNames));
  resolvedVendors.forEach(vendor => vendorMap.set(vendor.name.toLowerCase(), vendor.id));
  await db.insert(projects).values(validation.accepted.map((row, index) => ({ ...row, vendorId: vendorMap.get(row.vendorName.toLowerCase()) ?? null, sourceImportId: importId, sourceRowNumber: index + 2 }))).onDuplicateKeyUpdate({ set: { title: sql`VALUES(title)`, description: sql`VALUES(description)`, category: sql`VALUES(category)`, state: sql`VALUES(state)`, district: sql`VALUES(district)`, locality: sql`VALUES(locality)`, latitude: sql`VALUES(latitude)`, longitude: sql`VALUES(longitude)`, vendorId: sql`VALUES(vendorId)`, financialYear: sql`VALUES(financialYear)`, sanctionedAmount: sql`VALUES(sanctionedAmount)`, estimatedAmount: sql`VALUES(estimatedAmount)`, actualExpenditure: sql`VALUES(actualExpenditure)`, sanctionDate: sql`VALUES(sanctionDate)`, expectedCompletionDate: sql`VALUES(expectedCompletionDate)`, lastUpdateDate: sql`VALUES(lastUpdateDate)`, progressPercent: sql`VALUES(progressPercent)`, status: sql`VALUES(status)`, sourceImportId: sql`VALUES(sourceImportId)`, sourceRowNumber: sql`VALUES(sourceRowNumber)` } });
  if (validation.issues.length) await db.insert(dataQualityIssues).values(validation.issues.map(issue => ({ dataImportId: importId, sourceRowNumber: issue.rowNumber, fieldName: issue.field, severity: issue.severity, message: issue.message })));
  await db.update(dataImports).set({ importStatus: "imported" }).where(eq(dataImports.id, importId));
  return { success: true as const, ...validation, importId, storageUrl: url };
}
