PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_subjects` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`display_name` text NOT NULL,
	`avatar` text(2048) NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`username` text NOT NULL,
	`email_address` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_subjects`("id", "created_at", "updated_at", "display_name", "avatar", "role", "username", "email_address") SELECT "id", "created_at", "updated_at", "display_name", "avatar", "role", "username", "email_address" FROM `subjects`;--> statement-breakpoint
DROP TABLE `subjects`;--> statement-breakpoint
ALTER TABLE `__new_subjects` RENAME TO `subjects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_id_unique` ON `subjects` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_username_unique` ON `subjects` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_email_address_unique` ON `subjects` (`email_address`);
