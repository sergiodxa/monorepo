DROP INDEX `monitors_team_visiblity_idx`;--> statement-breakpoint
ALTER TABLE `monitors` ADD `degraded_after_ms` integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitors` DROP COLUMN `visibility`;