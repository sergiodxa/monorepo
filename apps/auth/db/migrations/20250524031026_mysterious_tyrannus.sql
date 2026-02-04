CREATE TABLE `clients` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text(255) NOT NULL,
	`secret` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`logout_uri` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_id_unique` ON `clients` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_redirect_uri_unique` ON `clients` (`redirect_uri`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`external_id` text NOT NULL,
	`provider` text(255) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_id_unique` ON `connections` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_connections_subject_id` ON `connections` (`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`verified_at` integer,
	`subject_id` text(36) NOT NULL,
	`password_hash` text NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_id_unique` ON `credentials` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_subject_id_unique` ON `credentials` (`subject_id`);--> statement-breakpoint
CREATE INDEX `credentials_subject_verified_idx` ON `credentials` (`subject_id`,`verified_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`client_id` text(36) NOT NULL,
	`user_agent` text(512),
	`ip_address` text(64),
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_id_unique` ON `sessions` (`id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_subject_id_idx` ON `sessions` (`subject_id`);--> statement-breakpoint
CREATE INDEX `sessions_client_id_idx` ON `sessions` (`client_id`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`email_address` text(255) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_id_unique` ON `subjects` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_email_address_unique` ON `subjects` (`email_address`);
