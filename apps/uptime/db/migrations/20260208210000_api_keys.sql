-- API Keys table for public API authentication
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	`expires_at` integer,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`scopes` text NOT NULL
);

CREATE INDEX `api_keys_team_idx` ON `api_keys` (`team_id`);
CREATE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);
