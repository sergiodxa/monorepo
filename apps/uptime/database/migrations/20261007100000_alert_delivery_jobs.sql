-- Alert delivery moves off the check that detected the transition and into a queued job
-- that retries with backoff, so a row needs three things it never had:
--
--   alert_events.status = 'pending'  -> recorded when the delivery is queued, then settled to
--                                       'sent' or 'failed' by the job. No DDL: the column is
--                                       plain TEXT NOT NULL with no CHECK constraint, and the
--                                       enum lives in `database/schema.ts`.
--   alert_events.delivery_ref        -> JSON naming where the platform put the message, so a
--                                       recovery edits the original in place where it can.
--   alerts.broken_at / broken_reason -> set when the destination answers that it no longer
--                                       exists, cleared when the alert's channel is saved again.
--
-- Every column is new, nullable and has no default, which SQLite adds in place; existing
-- rows read NULL, which means "no ref" and "not broken".
ALTER TABLE `alert_events` ADD COLUMN `delivery_ref` text;
--> statement-breakpoint
ALTER TABLE `alerts` ADD COLUMN `broken_at` integer;
--> statement-breakpoint
ALTER TABLE `alerts` ADD COLUMN `broken_reason` text;
