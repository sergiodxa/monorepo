CREATE TABLE `monitor_results` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`failed_at` integer,
	`succeeded_at` integer,
	`monitor_id` text(36) NOT NULL,
	`response_status` integer NOT NULL,
	`response_time_ms` integer NOT NULL,
	`response_body` text NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitor_results_id_unique` ON `monitor_results` (`id`);--> statement-breakpoint
CREATE TABLE `monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`url` text(2048) NOT NULL,
	`method` text DEFAULT 'GET' NOT NULL,
	`expected_status` integer DEFAULT 200 NOT NULL,
	`interval_seconds` integer NOT NULL,
	`enabled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_id_unique` ON `monitors` (`id`);--> statement-breakpoint
CREATE TABLE `subject_providers` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`provider_id` text(255) NOT NULL,
	`provider_name` text(255) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subject_providers_id_unique` ON `subject_providers` (`id`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`email_address` text(255) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_id_unique` ON `subjects` (`id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`role` text DEFAULT 'guest' NOT NULL,
	`avatar` text(2048) NOT NULL,
	`display_name` text(255) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_id_unique` ON `users` (`id`);