CREATE TABLE `grants` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`subject_id` text(36) NOT NULL,
	`client_id` text(36) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grants_id_unique` ON `grants` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `grants_subject_client_idx` ON `grants` (`subject_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `grants_client_id_idx` ON `grants` (`client_id`);