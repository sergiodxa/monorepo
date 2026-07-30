PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`url` text(2048) NOT NULL,
	`method` text DEFAULT 'GET' NOT NULL,
	`expected_status` integer DEFAULT 200 NOT NULL,
	`interval_seconds` integer DEFAULT 60 NOT NULL,
	`enabled_at` integer,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_monitors`("id", "created_at", "updated_at", "subject_id", "name", "url", "method", "expected_status", "interval_seconds", "enabled_at") SELECT "id", "created_at", "updated_at", "subject_id", "name", "url", "method", "expected_status", "interval_seconds", "enabled_at" FROM `monitors`;--> statement-breakpoint
DROP TABLE `monitors`;--> statement-breakpoint
ALTER TABLE `__new_monitors` RENAME TO `monitors`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_id_unique` ON `monitors` (`id`);--> statement-breakpoint
ALTER TABLE `monitor_results` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `monitor_results` DROP COLUMN `failed_at`;--> statement-breakpoint
ALTER TABLE `monitor_results` DROP COLUMN `succeeded_at`;