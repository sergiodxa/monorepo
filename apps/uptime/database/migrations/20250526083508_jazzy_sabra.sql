DROP TABLE `users`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_memberships` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`team_id` text(36) NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_memberships`("id", "created_at", "updated_at", "subject_id", "team_id", "role") SELECT "id", "created_at", "updated_at", "subject_id", "team_id", "role" FROM `memberships`;--> statement-breakpoint
DROP TABLE `memberships`;--> statement-breakpoint
ALTER TABLE `__new_memberships` RENAME TO `memberships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_id_unique` ON `memberships` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_subject_id_unique` ON `memberships` (`subject_id`);--> statement-breakpoint
CREATE INDEX `memberships_team_idx` ON `memberships` (`team_id`);--> statement-breakpoint
CREATE INDEX `memberships_subject_idx` ON `memberships` (`subject_id`);--> statement-breakpoint
CREATE INDEX `memberships_subject_team_idx` ON `memberships` (`subject_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `__new_invites` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`accepted_at` integer,
	`sender_id` text(36) NOT NULL,
	`team_id` text(36) NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_invites`("id", "created_at", "updated_at", "accepted_at", "sender_id", "team_id", "email") SELECT "id", "created_at", "updated_at", "accepted_at", "sender_id", "team_id", "email" FROM `invites`;--> statement-breakpoint
DROP TABLE `invites`;--> statement-breakpoint
ALTER TABLE `__new_invites` RENAME TO `invites`;--> statement-breakpoint
CREATE UNIQUE INDEX `invites_id_unique` ON `invites` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invites_sender_id_unique` ON `invites` (`sender_id`);--> statement-breakpoint
CREATE TABLE `__new_monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`enabled_at` integer,
	`team_id` text(36) NOT NULL,
	`author_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`url` text(2048) NOT NULL,
	`method` text DEFAULT 'GET' NOT NULL,
	`expected_status` integer DEFAULT 200 NOT NULL,
	`interval_seconds` integer DEFAULT 60 NOT NULL,
	`timeout_seconds` integer DEFAULT 10 NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_monitors`("id", "created_at", "updated_at", "enabled_at", "team_id", "author_id", "name", "url", "method", "expected_status", "interval_seconds", "timeout_seconds") SELECT "id", "created_at", "updated_at", "enabled_at", "team_id", "author_id", "name", "url", "method", "expected_status", "interval_seconds", "timeout_seconds" FROM `monitors`;--> statement-breakpoint
DROP TABLE `monitors`;--> statement-breakpoint
ALTER TABLE `__new_monitors` RENAME TO `monitors`;--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_id_unique` ON `monitors` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_author_id_unique` ON `monitors` (`author_id`);--> statement-breakpoint
CREATE TABLE `__new_teams` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`owner_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`slug` text(255) NOT NULL,
	`logo` text(2048)
);
--> statement-breakpoint
INSERT INTO `__new_teams`("id", "created_at", "updated_at", "owner_id", "name", "slug", "logo") SELECT "id", "created_at", "updated_at", "owner_id", "name", "slug", "logo" FROM `teams`;--> statement-breakpoint
DROP TABLE `teams`;--> statement-breakpoint
ALTER TABLE `__new_teams` RENAME TO `teams`;--> statement-breakpoint
CREATE UNIQUE INDEX `teams_id_unique` ON `teams` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_owner_id_unique` ON `teams` (`owner_id`);--> statement-breakpoint
CREATE TABLE `__new_monitor_results` (
	`id` text(36),
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	`monitor_id` text(36) NOT NULL,
	`response_status` integer,
	`response_time_ms` integer,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_monitor_results`("id", "created_at", "updated_at", "completed_at", "monitor_id", "response_status", "response_time_ms") SELECT "id", "created_at", "updated_at", "completed_at", "monitor_id", "response_status", "response_time_ms" FROM `monitor_results`;--> statement-breakpoint
DROP TABLE `monitor_results`;--> statement-breakpoint
ALTER TABLE `__new_monitor_results` RENAME TO `monitor_results`;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_results_id_unique` ON `monitor_results` (`id`);--> statement-breakpoint
CREATE INDEX `team_domains_verified_hostname_idx` ON `team_domains` (`verified_at`,`hostname`);