-- Migration: Add user language preference table
-- This stores the preferred language for each user (subject)

CREATE TABLE IF NOT EXISTS `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text NOT NULL,
	`preferred_language` text
);

CREATE UNIQUE INDEX IF NOT EXISTS `user_preferences_subject_idx` ON `user_preferences` (`subject_id`);
