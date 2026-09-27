-- Records for the API's Idempotency-Key header: one row per key a caller sent to a create
-- endpoint, holding the claim while the request runs and the stored response for 24 hours
-- after. The shape is the one `@sdxc/idempotency/data-table` claims against with a single
-- upsert, so a retry arriving mid-request is told the key is in use instead of creating twice.
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY,
	`fingerprint` text,
	`lease` text NOT NULL,
	`state` text NOT NULL,
	`response` text,
	`lease_expires_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idempotency_keys_expires_at_idx` ON `idempotency_keys` (`expires_at`);
