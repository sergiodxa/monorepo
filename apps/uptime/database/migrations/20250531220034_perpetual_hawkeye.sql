CREATE TABLE `alerts` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`monitor_id` text(36),
	`strategy` text NOT NULL,
	`config` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_id_unique` ON `alerts` (`id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`location_hint` text DEFAULT 'wnam' NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_monitors`("id", "created_at", "updated_at", "enabled_at", "team_id", "author_id", "name", "url", "method", "expected_status", "interval_seconds", "timeout_seconds", "visibility", "location_hint") SELECT "id", "created_at", "updated_at", "enabled_at", "team_id", "author_id", "name", "url", "method", "expected_status", "interval_seconds", "timeout_seconds", "visibility", "location_hint" FROM `monitors`;--> statement-breakpoint
DROP TABLE `monitors`;--> statement-breakpoint
ALTER TABLE `__new_monitors` RENAME TO `monitors`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_id_unique` ON `monitors` (`id`);--> statement-breakpoint
CREATE INDEX `monitors_created_at_idx` ON `monitors` (`created_at`);--> statement-breakpoint
CREATE INDEX `monitors_team_idx` ON `monitors` (`team_id`);--> statement-breakpoint
CREATE INDEX `monitors_team_visiblity_idx` ON `monitors` (`team_id`,`visibility`);