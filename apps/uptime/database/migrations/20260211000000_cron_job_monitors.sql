-- Add cron_job_monitors table
CREATE TABLE `cron_job_monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`cron_expression` text NOT NULL,
	`grace_period_seconds` integer DEFAULT 300 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`alert_on_late` integer DEFAULT 0 NOT NULL,
	`last_ping_at` integer,
	`next_expected_at` integer,
	`enabled_at` integer
);
--> statement-breakpoint
CREATE INDEX `cron_job_monitors_team_idx` ON `cron_job_monitors` (`team_id`);
--> statement-breakpoint
CREATE INDEX `cron_job_monitors_enabled_at_idx` ON `cron_job_monitors` (`enabled_at`);
--> statement-breakpoint
CREATE INDEX `cron_job_monitors_status_next_expected_idx` ON `cron_job_monitors` (`status`, `next_expected_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_job_monitors_id_unique` ON `cron_job_monitors` (`id`);

--> statement-breakpoint
-- Add cron_job_pings table
CREATE TABLE `cron_job_pings` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`cron_job_monitor_id` text(36) NOT NULL,
	`was_on_time` integer NOT NULL,
	`source_ip` text,
	`user_agent` text
);
--> statement-breakpoint
CREATE INDEX `cron_job_pings_cron_job_monitor_idx` ON `cron_job_pings` (`cron_job_monitor_id`);
--> statement-breakpoint
CREATE INDEX `cron_job_pings_created_at_idx` ON `cron_job_pings` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_job_pings_id_unique` ON `cron_job_pings` (`id`);

--> statement-breakpoint
-- Add status_page_cron_jobs junction table
CREATE TABLE `status_page_cron_jobs` (
	`status_page_id` text(36) NOT NULL,
	`cron_job_monitor_id` text(36) NOT NULL,
	`display_name` text,
	`order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`status_page_id`, `cron_job_monitor_id`)
);
--> statement-breakpoint
CREATE INDEX `status_page_cron_jobs_status_page_idx` ON `status_page_cron_jobs` (`status_page_id`);
--> statement-breakpoint
CREATE INDEX `status_page_cron_jobs_cron_job_monitor_idx` ON `status_page_cron_jobs` (`cron_job_monitor_id`);
