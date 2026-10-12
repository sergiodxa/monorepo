DELETE FROM `sessions`;--> statement-breakpoint
ALTER TABLE `sessions` ADD `refresh_token_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_refresh_token_hash_unique` ON `sessions` (`refresh_token_hash`);
