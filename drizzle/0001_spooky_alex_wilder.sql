CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letterRequestId` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`storagePath` varchar(1000) NOT NULL,
	`storageUrl` varchar(2000),
	`fileName` varchar(500) NOT NULL,
	`mimeType` varchar(200),
	`sizeBytes` bigint,
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `letter_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`letterType` enum('demand-letter','cease-and-desist','contract-breach','eviction-notice','employment-dispute','consumer-complaint','general-legal') NOT NULL,
	`subject` varchar(500) NOT NULL,
	`issueSummary` text,
	`jurisdictionCountry` varchar(100) DEFAULT 'US',
	`jurisdictionState` varchar(100),
	`jurisdictionCity` varchar(200),
	`intakeJson` json,
	`status` enum('draft','submitted','researching','drafting','pending_review','under_review','needs_changes','approved','rejected') NOT NULL DEFAULT 'draft',
	`assignedReviewerId` int,
	`currentAiDraftVersionId` int,
	`currentFinalVersionId` int,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`lastStatusChangedAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `letter_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `letter_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letterRequestId` int NOT NULL,
	`versionType` enum('ai_draft','attorney_edit','final_approved') NOT NULL,
	`content` text NOT NULL,
	`createdByType` enum('system','subscriber','employee','admin') NOT NULL,
	`createdByUserId` int,
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `letter_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(100) NOT NULL,
	`title` varchar(500) NOT NULL,
	`body` text,
	`link` varchar(1000),
	`readAt` timestamp,
	`metadataJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letterRequestId` int NOT NULL,
	`workflowJobId` int,
	`provider` varchar(50) DEFAULT 'perplexity',
	`status` enum('queued','running','completed','failed','invalid') NOT NULL DEFAULT 'queued',
	`queryPlanJson` json,
	`resultJson` json,
	`validationResultJson` json,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letterRequestId` int NOT NULL,
	`reviewerId` int,
	`actorType` enum('system','subscriber','employee','admin') NOT NULL,
	`action` varchar(100) NOT NULL,
	`noteText` text,
	`noteVisibility` enum('internal','user_visible') DEFAULT 'internal',
	`fromStatus` varchar(50),
	`toStatus` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`letterRequestId` int NOT NULL,
	`jobType` enum('research','draft_generation','generation_pipeline','retry') NOT NULL,
	`provider` varchar(50),
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
	`attemptCount` int DEFAULT 0,
	`errorMessage` text,
	`requestPayloadJson` json,
	`responsePayloadJson` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('subscriber','employee','admin') NOT NULL DEFAULT 'subscriber';--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;