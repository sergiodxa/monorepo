-- Take the vendor's name off the stored identifiers, and record deliveries before trusting
-- them.
--
-- The projection's columns were named after the one platform that fed them, which makes the
-- platform implicit in the schema: a row says nothing about who issued the id it holds, so a
-- second platform — or a second account on this one — could not coexist with the first. The
-- names below say what the value *is* instead of who produced it.
--
-- `billing_product_slug` is not a rename of the same value. Every call site now names a
-- product by our own slug, so the column holds that slug and the platform's product id stops
-- existing outside the one map that translates it; the statement below rewrites the single
-- id this app has ever stored there.
--
-- `billing_read_at` replaces the payload's own modified-at stamp because the projection is no
-- longer patched from a delivery. Each write applies a whole snapshot of what the customer
-- holds, so the ordering question is "which read is fresher", and the answer is when the
-- platform answered.
ALTER TABLE `subscriptions` RENAME COLUMN `polar_subscription_id` TO `billing_subscription_id`;
--> statement-breakpoint
ALTER TABLE `subscriptions` RENAME COLUMN `polar_product_id` TO `billing_product_slug`;
--> statement-breakpoint
ALTER TABLE `subscriptions` RENAME COLUMN `polar_modified_at` TO `billing_read_at`;
--> statement-breakpoint
UPDATE `subscriptions`
   SET `billing_product_slug` = 'monitoring'
 WHERE `billing_product_slug` = '94161883-14eb-42e2-bb26-b4647199cda1';
--> statement-breakpoint
-- SQLite carries a renamed column into the indexes over it but keeps the index's own name, so
-- the conflict target is recreated rather than left named after the vendor it no longer names.
DROP INDEX `subscriptions_polar_subscription_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_billing_subscription_idx` ON `subscriptions` (`billing_subscription_id`);
--> statement-breakpoint
-- Every delivery the billing endpoint receives, written with its signature verdict before any
-- handler runs. It is what gives idempotency a key that survives the request: the platform
-- retries a delivery under the same id, and a row already marked processed is acknowledged
-- without running the handler a second time.
--
-- `payload` keeps the body exactly as received, since that is the text the signature covered
-- and the only version of the delivery worth re-reading. `valid` and `processed` are separate
-- because a forged delivery is evidence worth keeping while an unprocessed one is a repair the
-- daily sweep will make by re-reading the customer.
--
-- No index beyond the primary key (ADR-010): every read here is a point lookup by delivery id,
-- and the sweep's retention delete scans a table the same sweep keeps small.
CREATE TABLE `billing_webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`valid` integer NOT NULL,
	`processed` integer NOT NULL
);
