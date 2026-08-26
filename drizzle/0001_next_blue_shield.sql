CREATE TABLE `alert_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`metric` varchar(96) NOT NULL,
	`label` varchar(160) NOT NULL,
	`valueText` varchar(255) NOT NULL,
	`benchmarkText` varchar(255),
	`unit` varchar(64),
	`description` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `alert_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`linkedProjectId` int NOT NULL,
	`relation` enum('peer','potential_duplicate','vendor_peer') NOT NULL,
	CONSTRAINT `alert_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditRunId` int NOT NULL,
	`projectId` int NOT NULL,
	`riskType` enum('cost_outlier','duplicate_work','vendor_concentration','stalled_project','data_quality') NOT NULL,
	`riskScore` int NOT NULL,
	`riskBand` enum('critical','high','moderate','low') NOT NULL,
	`alertStatus` enum('open','field_verification','dismissed','resolved') NOT NULL DEFAULT 'open',
	`title` varchar(255) NOT NULL,
	`rationale` text NOT NULL,
	`peerGroup` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runCode` varchar(48) NOT NULL,
	`algorithmVersion` varchar(64) NOT NULL,
	`sourceDigest` varchar(96) NOT NULL,
	`configuration` json,
	`totalProjects` int NOT NULL,
	`totalAlerts` int NOT NULL DEFAULT 0,
	`status` enum('running','completed','failed') NOT NULL,
	`initiatedBy` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `audit_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_runs_run_code_uq` UNIQUE(`runCode`)
);
--> statement-breakpoint
CREATE TABLE `data_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`storageKey` varchar(512),
	`storageUrl` varchar(1024),
	`checksum` varchar(96) NOT NULL,
	`totalRows` int NOT NULL,
	`acceptedRows` int NOT NULL,
	`warningCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`importStatus` enum('validated','imported','failed') NOT NULL,
	`importedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_quality_issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataImportId` int,
	`projectId` int,
	`sourceRowNumber` int,
	`fieldName` varchar(96) NOT NULL,
	`severity` enum('warning','error') NOT NULL,
	`message` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_quality_issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`milestoneName` varchar(160) NOT NULL,
	`plannedDate` timestamp,
	`actualDate` timestamp,
	`plannedAmount` double NOT NULL DEFAULT 0,
	`paidAmount` double NOT NULL DEFAULT 0,
	`status` enum('planned','released','paid','delayed') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectCode` varchar(72) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(128) NOT NULL,
	`state` varchar(128) NOT NULL,
	`district` varchar(128) NOT NULL,
	`locality` varchar(160) NOT NULL,
	`latitude` double,
	`longitude` double,
	`vendorId` int,
	`financialYear` varchar(16) NOT NULL,
	`sanctionedAmount` double NOT NULL,
	`estimatedAmount` double,
	`actualExpenditure` double NOT NULL DEFAULT 0,
	`sanctionDate` timestamp NOT NULL,
	`expectedCompletionDate` timestamp NOT NULL,
	`lastUpdateDate` timestamp NOT NULL,
	`progressPercent` int NOT NULL DEFAULT 0,
	`status` enum('planning','ongoing','completed','on_hold','cancelled') NOT NULL,
	`sourceImportId` int,
	`sourceRowNumber` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_project_code_uq` UNIQUE(`projectCode`)
);
--> statement-breakpoint
CREATE TABLE `reviewer_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`reviewerId` int,
	`action` enum('field_verification','dismissed','resolved') NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviewer_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendorCode` varchar(48) NOT NULL,
	`name` varchar(255) NOT NULL,
	`state` varchar(128) NOT NULL,
	`vendorType` varchar(128) NOT NULL DEFAULT 'Works contractor',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendors_vendor_code_uq` UNIQUE(`vendorCode`)
);
--> statement-breakpoint
ALTER TABLE `alert_evidence` ADD CONSTRAINT `alert_evidence_alertId_audit_alerts_id_fk` FOREIGN KEY (`alertId`) REFERENCES `audit_alerts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_links` ADD CONSTRAINT `alert_links_alertId_audit_alerts_id_fk` FOREIGN KEY (`alertId`) REFERENCES `audit_alerts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_links` ADD CONSTRAINT `alert_links_linkedProjectId_projects_id_fk` FOREIGN KEY (`linkedProjectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_alerts` ADD CONSTRAINT `audit_alerts_auditRunId_audit_runs_id_fk` FOREIGN KEY (`auditRunId`) REFERENCES `audit_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_alerts` ADD CONSTRAINT `audit_alerts_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_runs` ADD CONSTRAINT `audit_runs_initiatedBy_users_id_fk` FOREIGN KEY (`initiatedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_quality_issues` ADD CONSTRAINT `data_quality_issues_dataImportId_data_imports_id_fk` FOREIGN KEY (`dataImportId`) REFERENCES `data_imports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_quality_issues` ADD CONSTRAINT `data_quality_issues_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_milestones` ADD CONSTRAINT `financial_milestones_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_vendorId_vendors_id_fk` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_sourceImportId_data_imports_id_fk` FOREIGN KEY (`sourceImportId`) REFERENCES `data_imports`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewer_actions` ADD CONSTRAINT `reviewer_actions_alertId_audit_alerts_id_fk` FOREIGN KEY (`alertId`) REFERENCES `audit_alerts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewer_actions` ADD CONSTRAINT `reviewer_actions_reviewerId_users_id_fk` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `alert_evidence_alert_idx` ON `alert_evidence` (`alertId`);--> statement-breakpoint
CREATE INDEX `alert_links_alert_idx` ON `alert_links` (`alertId`);--> statement-breakpoint
CREATE INDEX `alert_links_project_idx` ON `alert_links` (`linkedProjectId`);--> statement-breakpoint
CREATE INDEX `audit_alerts_run_idx` ON `audit_alerts` (`auditRunId`);--> statement-breakpoint
CREATE INDEX `audit_alerts_project_idx` ON `audit_alerts` (`projectId`);--> statement-breakpoint
CREATE INDEX `audit_alerts_status_idx` ON `audit_alerts` (`alertStatus`,`riskBand`);--> statement-breakpoint
CREATE INDEX `audit_runs_status_idx` ON `audit_runs` (`status`);--> statement-breakpoint
CREATE INDEX `data_imports_status_idx` ON `data_imports` (`importStatus`);--> statement-breakpoint
CREATE INDEX `data_quality_issues_project_idx` ON `data_quality_issues` (`projectId`);--> statement-breakpoint
CREATE INDEX `data_quality_issues_import_idx` ON `data_quality_issues` (`dataImportId`);--> statement-breakpoint
CREATE INDEX `financial_milestones_project_idx` ON `financial_milestones` (`projectId`);--> statement-breakpoint
CREATE INDEX `projects_cohort_idx` ON `projects` (`category`,`state`,`financialYear`);--> statement-breakpoint
CREATE INDEX `projects_vendor_period_idx` ON `projects` (`vendorId`,`financialYear`);--> statement-breakpoint
CREATE INDEX `projects_location_idx` ON `projects` (`state`,`district`,`locality`);--> statement-breakpoint
CREATE INDEX `reviewer_actions_alert_idx` ON `reviewer_actions` (`alertId`);