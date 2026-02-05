PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_monitor_results` (
	`id` text(36) PRIMARY KEY NOT NULL,
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
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_results_id_unique` ON `monitor_results` (`id`);--> statement-breakpoint
ALTER TABLE `monitors` ADD `visibility` text DEFAULT 'private' NOT NULL;