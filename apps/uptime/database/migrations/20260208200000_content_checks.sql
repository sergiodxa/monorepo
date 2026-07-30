-- Add monitor_content_checks table for keyword/content monitoring
CREATE TABLE `monitor_content_checks` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`monitor_id` text(36) NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`case_sensitive` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `monitor_content_checks_monitor_idx` ON `monitor_content_checks` (`monitor_id`);
--> statement-breakpoint
CREATE INDEX `monitor_content_checks_monitor_enabled_idx` ON `monitor_content_checks` (`monitor_id`, `is_enabled`);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_content_checks_id_unique` ON `monitor_content_checks` (`id`);
