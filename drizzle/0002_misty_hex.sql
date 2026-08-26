CREATE TABLE `allocation_model_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelCode` varchar(96) NOT NULL,
	`modelVersion` varchar(96) NOT NULL,
	`sourceImportId` int NOT NULL,
	`trainingRows` int NOT NULL,
	`methodology` text NOT NULL,
	`configuration` json,
	`evaluation` json,
	`status` enum('training','completed','failed') NOT NULL,
	`trainedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `allocation_model_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `allocation_model_runs_code_uq` UNIQUE(`modelCode`)
);
--> statement-breakpoint
CREATE TABLE `allocation_model_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelRunId` int NOT NULL,
	`allocationRecordId` int NOT NULL,
	`contextBand` enum('high_variance','moderate_variance','expected_range') NOT NULL,
	`modelScore` int NOT NULL,
	`varianceDirection` enum('above_peer_median','below_peer_median','at_peer_median') NOT NULL,
	`statePeerCount` int NOT NULL,
	`statePeerMedian` double NOT NULL,
	`nationalPeerMedian` double NOT NULL,
	`appliedVariancePercent` double NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `allocation_model_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `allocation_model_scores_run_record_uq` UNIQUE(`modelRunId`,`allocationRecordId`)
);
--> statement-breakpoint
CREATE TABLE `official_allocation_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceUrl` varchar(1024) NOT NULL,
	`sourceScope` varchar(255) NOT NULL,
	`publicAssetUrl` varchar(1024) NOT NULL,
	`sourceSha256` varchar(96) NOT NULL,
	`retrievedAt` timestamp NOT NULL,
	`rowCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `official_allocation_imports_id` PRIMARY KEY(`id`),
	CONSTRAINT `official_allocation_imports_sha_uq` UNIQUE(`sourceSha256`)
);
--> statement-breakpoint
CREATE TABLE `official_allocation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceImportId` int NOT NULL,
	`sourceRowNumber` int NOT NULL,
	`state` varchar(128) NOT NULL,
	`mpName` varchar(255) NOT NULL,
	`constituency` varchar(255) NOT NULL,
	`allocatedAmount` double NOT NULL,
	CONSTRAINT `official_allocation_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `official_allocation_record_source_row_uq` UNIQUE(`sourceImportId`,`sourceRowNumber`)
);
--> statement-breakpoint
ALTER TABLE `allocation_model_runs` ADD CONSTRAINT `amr_import_fk` FOREIGN KEY (`sourceImportId`) REFERENCES `official_allocation_imports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allocation_model_scores` ADD CONSTRAINT `ams_run_fk` FOREIGN KEY (`modelRunId`) REFERENCES `allocation_model_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allocation_model_scores` ADD CONSTRAINT `ams_record_fk` FOREIGN KEY (`allocationRecordId`) REFERENCES `official_allocation_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `official_allocation_records` ADD CONSTRAINT `oar_import_fk` FOREIGN KEY (`sourceImportId`) REFERENCES `official_allocation_imports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `allocation_model_runs_status_idx` ON `allocation_model_runs` (`status`);--> statement-breakpoint
CREATE INDEX `allocation_model_scores_run_idx` ON `allocation_model_scores` (`modelRunId`,`contextBand`);--> statement-breakpoint
CREATE INDEX `official_allocation_records_state_idx` ON `official_allocation_records` (`state`);
