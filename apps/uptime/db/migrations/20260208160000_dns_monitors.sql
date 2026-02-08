-- Add dns_monitors table
CREATE TABLE `dns_monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`record_type` text NOT NULL,
	`expected_value` text,
	`interval_seconds` integer DEFAULT 3600 NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`last_checked_at` integer,
	`last_status` text,
	`last_value` text
);
--> statement-breakpoint
CREATE INDEX `dns_monitors_team_idx` ON `dns_monitors` (`team_id`);
--> statement-breakpoint
CREATE INDEX `dns_monitors_is_enabled_idx` ON `dns_monitors` (`is_enabled`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dns_monitors_id_unique` ON `dns_monitors` (`id`);

--> statement-breakpoint
-- Add dns_monitor_results table
CREATE TABLE `dns_monitor_results` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`dns_monitor_id` text(36) NOT NULL,
	`status` text NOT NULL,
	`resolved_value` text,
	`response_time_ms` integer,
	`error_message` text,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dns_monitor_results_dns_monitor_idx` ON `dns_monitor_results` (`dns_monitor_id`);
--> statement-breakpoint
CREATE INDEX `dns_monitor_results_checked_at_idx` ON `dns_monitor_results` (`checked_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dns_monitor_results_id_unique` ON `dns_monitor_results` (`id`);
