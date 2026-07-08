-- Status Pages table
CREATE TABLE `status_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`logo_url` text,
	`custom_domain` text,
	`is_public` integer DEFAULT true NOT NULL,
	`show_overall_status` integer DEFAULT true NOT NULL
);

-- Status Page Monitors junction table
CREATE TABLE `status_page_monitors` (
	`status_page_id` text NOT NULL,
	`monitor_id` text NOT NULL,
	`display_name` text,
	`order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`status_page_id`, `monitor_id`)
);

-- Indexes
CREATE INDEX `status_pages_team_idx` ON `status_pages` (`team_id`);
CREATE UNIQUE INDEX `status_pages_slug_unique` ON `status_pages` (`slug`);
CREATE INDEX `status_pages_slug_idx` ON `status_pages` (`slug`);
CREATE INDEX `status_page_monitors_status_page_idx` ON `status_page_monitors` (`status_page_id`);
CREATE INDEX `status_page_monitors_monitor_idx` ON `status_page_monitors` (`monitor_id`);
