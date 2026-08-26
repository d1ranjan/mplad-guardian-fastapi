import {
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const vendors = mysqlTable(
  "vendors",
  {
    id: int("id").autoincrement().primaryKey(),
    vendorCode: varchar("vendorCode", { length: 48 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    state: varchar("state", { length: 128 }).notNull(),
    vendorType: varchar("vendorType", { length: 128 }).default("Works contractor").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("vendors_vendor_code_uq").on(table.vendorCode)],
);

export const dataImports = mysqlTable(
  "data_imports",
  {
    id: int("id").autoincrement().primaryKey(),
    originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }),
    storageUrl: varchar("storageUrl", { length: 1024 }),
    checksum: varchar("checksum", { length: 96 }).notNull(),
    totalRows: int("totalRows").notNull(),
    acceptedRows: int("acceptedRows").notNull(),
    warningCount: int("warningCount").notNull().default(0),
    errorCount: int("errorCount").notNull().default(0),
    importStatus: mysqlEnum("importStatus", ["validated", "imported", "failed"]).notNull(),
    importedBy: int("importedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("data_imports_status_idx").on(table.importStatus)],
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    projectCode: varchar("projectCode", { length: 72 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 128 }).notNull(),
    state: varchar("state", { length: 128 }).notNull(),
    district: varchar("district", { length: 128 }).notNull(),
    locality: varchar("locality", { length: 160 }).notNull(),
    latitude: double("latitude"),
    longitude: double("longitude"),
    vendorId: int("vendorId").references(() => vendors.id, { onDelete: "set null" }),
    financialYear: varchar("financialYear", { length: 16 }).notNull(),
    sanctionedAmount: double("sanctionedAmount").notNull(),
    estimatedAmount: double("estimatedAmount"),
    actualExpenditure: double("actualExpenditure").notNull().default(0),
    sanctionDate: timestamp("sanctionDate").notNull(),
    expectedCompletionDate: timestamp("expectedCompletionDate").notNull(),
    lastUpdateDate: timestamp("lastUpdateDate").notNull(),
    progressPercent: int("progressPercent").notNull().default(0),
    status: mysqlEnum("status", ["planning", "ongoing", "completed", "on_hold", "cancelled"]).notNull(),
    sourceImportId: int("sourceImportId").references(() => dataImports.id, { onDelete: "set null" }),
    sourceRowNumber: int("sourceRowNumber"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("projects_project_code_uq").on(table.projectCode),
    index("projects_cohort_idx").on(table.category, table.state, table.financialYear),
    index("projects_vendor_period_idx").on(table.vendorId, table.financialYear),
    index("projects_location_idx").on(table.state, table.district, table.locality),
  ],
);

export const financialMilestones = mysqlTable(
  "financial_milestones",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    milestoneName: varchar("milestoneName", { length: 160 }).notNull(),
    plannedDate: timestamp("plannedDate"),
    actualDate: timestamp("actualDate"),
    plannedAmount: double("plannedAmount").notNull().default(0),
    paidAmount: double("paidAmount").notNull().default(0),
    status: mysqlEnum("status", ["planned", "released", "paid", "delayed"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("financial_milestones_project_idx").on(table.projectId)],
);

export const auditRuns = mysqlTable(
  "audit_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    runCode: varchar("runCode", { length: 48 }).notNull(),
    algorithmVersion: varchar("algorithmVersion", { length: 64 }).notNull(),
    sourceDigest: varchar("sourceDigest", { length: 96 }).notNull(),
    configuration: json("configuration"),
    totalProjects: int("totalProjects").notNull(),
    totalAlerts: int("totalAlerts").notNull().default(0),
    status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
    initiatedBy: int("initiatedBy").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [uniqueIndex("audit_runs_run_code_uq").on(table.runCode), index("audit_runs_status_idx").on(table.status)],
);

export const auditAlerts = mysqlTable(
  "audit_alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    auditRunId: int("auditRunId").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    riskType: mysqlEnum("riskType", ["cost_outlier", "duplicate_work", "vendor_concentration", "stalled_project", "data_quality"]).notNull(),
    riskScore: int("riskScore").notNull(),
    riskBand: mysqlEnum("riskBand", ["critical", "high", "moderate", "low"]).notNull(),
    alertStatus: mysqlEnum("alertStatus", ["open", "field_verification", "dismissed", "resolved"]).notNull().default("open"),
    title: varchar("title", { length: 255 }).notNull(),
    rationale: text("rationale").notNull(),
    peerGroup: varchar("peerGroup", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("audit_alerts_run_idx").on(table.auditRunId),
    index("audit_alerts_project_idx").on(table.projectId),
    index("audit_alerts_status_idx").on(table.alertStatus, table.riskBand),
  ],
);

export const alertEvidence = mysqlTable(
  "alert_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    alertId: int("alertId").notNull().references(() => auditAlerts.id, { onDelete: "cascade" }),
    metric: varchar("metric", { length: 96 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    valueText: varchar("valueText", { length: 255 }).notNull(),
    benchmarkText: varchar("benchmarkText", { length: 255 }),
    unit: varchar("unit", { length: 64 }),
    description: text("description").notNull(),
    sortOrder: int("sortOrder").notNull().default(0),
  },
  table => [index("alert_evidence_alert_idx").on(table.alertId)],
);

export const alertLinks = mysqlTable(
  "alert_links",
  {
    id: int("id").autoincrement().primaryKey(),
    alertId: int("alertId").notNull().references(() => auditAlerts.id, { onDelete: "cascade" }),
    linkedProjectId: int("linkedProjectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    relation: mysqlEnum("relation", ["peer", "potential_duplicate", "vendor_peer"]).notNull(),
  },
  table => [index("alert_links_alert_idx").on(table.alertId), index("alert_links_project_idx").on(table.linkedProjectId)],
);

export const reviewerActions = mysqlTable(
  "reviewer_actions",
  {
    id: int("id").autoincrement().primaryKey(),
    alertId: int("alertId").notNull().references(() => auditAlerts.id, { onDelete: "cascade" }),
    reviewerId: int("reviewerId").references(() => users.id, { onDelete: "set null" }),
    action: mysqlEnum("action", ["field_verification", "dismissed", "resolved"]).notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("reviewer_actions_alert_idx").on(table.alertId)],
);

export const dataQualityIssues = mysqlTable(
  "data_quality_issues",
  {
    id: int("id").autoincrement().primaryKey(),
    dataImportId: int("dataImportId").references(() => dataImports.id, { onDelete: "cascade" }),
    projectId: int("projectId").references(() => projects.id, { onDelete: "cascade" }),
    sourceRowNumber: int("sourceRowNumber"),
    fieldName: varchar("fieldName", { length: 96 }).notNull(),
    severity: mysqlEnum("severity", ["warning", "error"]).notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("data_quality_issues_project_idx").on(table.projectId), index("data_quality_issues_import_idx").on(table.dataImportId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type AuditAlert = typeof auditAlerts.$inferSelect;
