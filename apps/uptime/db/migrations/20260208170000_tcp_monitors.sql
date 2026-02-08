-- Add tcp_monitors table
CREATE TABLE `tcp_monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL,
	`timeout_ms` integer DEFAULT 5000 NOT NULL,
	`interval_seconds` integer DEFAULT 60 NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`last_checked_at` integer,
	`last_status` text,
	`last_response_time_ms` integer
);
--> statement-breakpoint
CREATE INDEX `tcp_monitors_team_idx` ON `tcp_monitors` (`team_id`);
--> statement-breakpoint
CREATE INDEX `tcp_monitors_is_enabled_idx` ON `tcp_monitors` (`is_enabled`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tcp_monitors_id_unique` ON `tcp_monitors` (`id`);

--> statement-breakpoint
-- Add tcp_monitor_results table
CREATE TABLE `tcp_monitor_results` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`tcp_monitor_id` text(36) NOT NULL,
	`status` text NOT NULL,
	`response_time_ms` integer,
	`error_message` text,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tcp_monitor_results_tcp_monitor_idx` ON `tcp_monitor_results` (`tcp_monitor_id`);
--> statement-breakpoint
CREATE INDEX `tcp_monitor_results_checked_at_idx` ON `tcp_monitor_results` (`checked_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tcp_monitor_results_id_unique` ON `tcp_monitor_results` (`id`);
