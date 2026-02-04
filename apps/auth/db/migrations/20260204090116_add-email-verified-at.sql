PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_connections` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`external_id` text NOT NULL,
	`provider` text(255) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_connections`("id", "created_at", "updated_at", "subject_id", "external_id", "provider") SELECT "id", "created_at", "updated_at", "subject_id", "external_id", "provider" FROM `connections`;--> statement-breakpoint
DROP TABLE `connections`;--> statement-breakpoint
ALTER TABLE `__new_connections` RENAME TO `connections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `connections_id_unique` ON `connections` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_connections_subject_id` ON `connections` (`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `__new_credentials` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`verified_at` integer,
	`subject_id` text(36) NOT NULL,
	`password_hash` text NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_credentials`("id", "created_at", "updated_at", "verified_at", "subject_id", "password_hash") SELECT "id", "created_at", "updated_at", "verified_at", "subject_id", "password_hash" FROM `credentials`;--> statement-breakpoint
DROP TABLE `credentials`;--> statement-breakpoint
ALTER TABLE `__new_credentials` RENAME TO `credentials`;--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_id_unique` ON `credentials` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_subject_id_unique` ON `credentials` (`subject_id`);--> statement-breakpoint
CREATE INDEX `credentials_subject_verified_idx` ON `credentials` (`subject_id`,`verified_at`);--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`client_id` text(36) NOT NULL,
	`user_agent` text(512),
	`ip_address` text(64),
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "created_at", "updated_at", "expires_at", "subject_id", "client_id", "user_agent", "ip_address") SELECT "id", "created_at", "updated_at", "expires_at", "subject_id", "client_id", "user_agent", "ip_address" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_id_unique` ON `sessions` (`id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_subject_id_idx` ON `sessions` (`subject_id`);--> statement-breakpoint
CREATE INDEX `sessions_client_id_idx` ON `sessions` (`client_id`);--> statement-breakpoint
ALTER TABLE `subjects` ADD `email_verified_at` integer;--> statement-breakpoint
UPDATE `subjects` SET `email_verified_at` = `created_at` WHERE `id` IN (SELECT DISTINCT `subject_id` FROM `connections`);