PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_alerts` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`monitor_id` text(36),
	`strategy` text NOT NULL,
	`config` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_alerts`("id", "created_at", "updated_at", "team_id", "monitor_id", "strategy", "config") SELECT "id", "created_at", "updated_at", "team_id", "monitor_id", "strategy", "config" FROM `alerts`;--> statement-breakpoint
DROP TABLE `alerts`;--> statement-breakpoint
ALTER TABLE `__new_alerts` RENAME TO `alerts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_id_unique` ON `alerts` (`id`);--> statement-breakpoint
CREATE TABLE `__new_invites` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`accepted_at` integer,
	`sender_id` text(36) NOT NULL,
	`team_id` text(36) NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_invites`("id", "created_at", "updated_at", "accepted_at", "sender_id", "team_id", "email") SELECT "id", "created_at", "updated_at", "accepted_at", "sender_id", "team_id", "email" FROM `invites`;--> statement-breakpoint
DROP TABLE `invites`;--> statement-breakpoint
ALTER TABLE `__new_invites` RENAME TO `invites`;--> statement-breakpoint
CREATE UNIQUE INDEX `invites_id_unique` ON `invites` (`id`);--> statement-breakpoint
CREATE TABLE `__new_memberships` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`team_id` text(36) NOT NULL,
	`role` text DEFAULT 'member' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_memberships`("id", "created_at", "updated_at", "subject_id", "team_id", "role") SELECT "id", "created_at", "updated_at", "subject_id", "team_id", "role" FROM `memberships`;--> statement-breakpoint
DROP TABLE `memberships`;--> statement-breakpoint
ALTER TABLE `__new_memberships` RENAME TO `memberships`;--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_id_unique` ON `memberships` (`id`);--> statement-breakpoint
CREATE INDEX `memberships_team_idx` ON `memberships` (`team_id`);--> statement-breakpoint
CREATE INDEX `memberships_subject_idx` ON `memberships` (`subject_id`);--> statement-breakpoint
CREATE INDEX `memberships_subject_team_idx` ON `memberships` (`subject_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `__new_monitor_results` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	`monitor_id` text(36) NOT NULL,
	`response_status` integer,
	`response_time_ms` integer
);
--> statement-breakpoint
INSERT INTO `__new_monitor_results`("id", "created_at", "updated_at", "completed_at", "monitor_id", "response_status", "response_time_ms") SELECT "id", "created_at", "updated_at", "completed_at", "monitor_id", "response_status", "response_time_ms" FROM `monitor_results`;--> statement-breakpoint
DROP TABLE `monitor_results`;--> statement-breakpoint
ALTER TABLE `__new_monitor_results` RENAME TO `monitor_results`;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_results_id_unique` ON `monitor_results` (`id`);--> statement-breakpoint
CREATE INDEX `monitor_results_created_at_idx` ON `monitor_results` (`created_at`);--> statement-breakpoint
CREATE INDEX `monitor_results_monitor_completed_at_response_status_response_time_idx` ON `monitor_results` (`monitor_id`,`completed_at`,`response_status`,`response_time_ms`);--> statement-breakpoint
CREATE TABLE `__new_monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`enabled_at` integer,
	`team_id` text(36) NOT NULL,
	`author_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`url` text(2048) NOT NULL,
	`method` text DEFAULT 'HEAD' NOT NULL,
	`expected_status` integer DEFAULT 200 NOT NULL,
	`interval_seconds` integer DEFAULT 60 NOT NULL,
	`timeout_seconds` integer DEFAULT 10 NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`location_hint` text DEFAULT 'wnam' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_monitors`("id", "created_at", "updated_at", "enabled_at", "team_id", "author_id", "name", "url", "method", "expected_status", "interval_seconds", "timeout_seconds", "visibility", "location_hint") SELECT "id", "created_at", "updated_at", "enabled_at", "team_id", "author_id", "name", "url", "method", "expected_status", "interval_seconds", "timeout_seconds", "visibility", "location_hint" FROM `monitors`;--> statement-breakpoint
DROP TABLE `monitors`;--> statement-breakpoint
ALTER TABLE `__new_monitors` RENAME TO `monitors`;--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_id_unique` ON `monitors` (`id`);--> statement-breakpoint
CREATE INDEX `monitors_created_at_idx` ON `monitors` (`created_at`);--> statement-breakpoint
CREATE INDEX `monitors_team_idx` ON `monitors` (`team_id`);--> statement-breakpoint
CREATE INDEX `monitors_team_visiblity_idx` ON `monitors` (`team_id`,`visibility`);--> statement-breakpoint
CREATE TABLE `__new_team_domains` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`verified_at` integer,
	`team_id` text(36) NOT NULL,
	`hostname` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_team_domains`("id", "created_at", "updated_at", "verified_at", "team_id", "hostname") SELECT "id", "created_at", "updated_at", "verified_at", "team_id", "hostname" FROM `team_domains`;--> statement-breakpoint
DROP TABLE `team_domains`;--> statement-breakpoint
ALTER TABLE `__new_team_domains` RENAME TO `team_domains`;--> statement-breakpoint
CREATE UNIQUE INDEX `team_domains_id_unique` ON `team_domains` (`id`);--> statement-breakpoint
CREATE INDEX `team_domains_verified_hostname_idx` ON `team_domains` (`verified_at`,`hostname`);