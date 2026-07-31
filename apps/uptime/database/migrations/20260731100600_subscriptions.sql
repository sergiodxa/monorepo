-- Replicate Polar subscription state into D1 (ADR-005)
-- The every-minute scheduler used to settle billing by asking Polar once per distinct
-- owner with a monitor due, which is 43,200 x K requests per owner per month and fails
-- closed on any Polar error — a Polar outage silently stopped all monitoring. These rows
-- are a projection of Polar's own state, written by the webhook and repaired by a daily
-- reconciliation sweep, so authorisation is a local indexed read and the check path makes
-- no API call at all.
--
-- No backfill: an owner with no row here is "we have never learned anything about them",
-- which the read path treats as allowed (ADR-005 section 6) rather than as unsubscribed.
-- The first webhook or the first reconciliation run fills the table in; until then every
-- existing monitor keeps being checked, which is the failure direction that costs
-- $0.0000348 instead of the product's reason to exist.
CREATE TABLE `subscriptions` (
  `id` text(36) PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `external_customer_id` text NOT NULL,
  `polar_subscription_id` text NOT NULL,
  `polar_product_id` text NOT NULL,
  `status` text NOT NULL,
  `current_period_end` integer,
  `revoked_at` integer,
  `polar_modified_at` integer NOT NULL
);

-- The conflict target the webhook upserts on, so a redelivered event updates the row it
-- already wrote instead of inserting a second one for the same subscription.
CREATE UNIQUE INDEX `subscriptions_polar_subscription_idx` ON `subscriptions` (`polar_subscription_id`);

-- Serves the whole authorisation read: every row for one customer, ordered so the active
-- ones are found first. Per ADR-010 there is deliberately no `subscriptions_id_unique`
-- index — the `PRIMARY KEY` above already maintains one, and a second would only add a
-- written row per insert and per delete.
CREATE INDEX `subscriptions_customer_status_idx` ON `subscriptions` (`external_customer_id`, `status`);
