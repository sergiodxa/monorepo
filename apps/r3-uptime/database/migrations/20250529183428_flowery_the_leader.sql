ALTER TABLE `monitors` ADD `location_hint` text DEFAULT 'wnam' NOT NULL;--> statement-breakpoint
DROP VIEW `monitor_results_per_day`;