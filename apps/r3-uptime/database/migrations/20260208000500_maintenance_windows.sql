-- Add maintenance_windows table
CREATE TABLE `maintenance_windows` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`monitor_id` text(36),
	`name` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`ended_early_at` integer,
	`suppress_alerts` integer DEFAULT 1 NOT NULL,
	`show_on_status_page` integer DEFAULT 1 NOT NULL,
	`is_recurring` integer DEFAULT 0 NOT NULL,
	`recurring_pattern` text
);
--> statement-breakpoint
CREATE INDEX `maintenance_windows_team_idx` ON `maintenance_windows` (`team_id`);
--> statement-breakpoint
CREATE INDEX `maintenance_windows_monitor_idx` ON `maintenance_windows` (`monitor_id`);
--> statement-breakpoint
CREATE INDEX `maintenance_windows_starts_at_ends_at_idx` ON `maintenance_windows` (`starts_at`,`ends_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `maintenance_windows_id_unique` ON `maintenance_windows` (`id`);
