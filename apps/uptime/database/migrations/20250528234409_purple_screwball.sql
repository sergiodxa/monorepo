CREATE INDEX `monitor_results_created_at_idx` ON `monitor_results` (`created_at`);--> statement-breakpoint
CREATE INDEX `monitor_results_monitor_completed_at_response_status_response_time_idx` ON `monitor_results` (`monitor_id`,`completed_at`,`response_status`,`response_time_ms`);--> statement-breakpoint
CREATE INDEX `monitors_created_at_idx` ON `monitors` (`created_at`);--> statement-breakpoint
CREATE INDEX `monitors_team_idx` ON `monitors` (`team_id`);--> statement-breakpoint
CREATE INDEX `monitors_team_visiblity_idx` ON `monitors` (`team_id`,`visibility`);