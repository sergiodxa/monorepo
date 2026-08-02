-- Persistence for the public trial: leads, the URLs they asked us to watch, and the hourly
-- checks behind the digests.
--
-- HTTP only, which is why `trial_watches` carries a `url` and no type column. The
-- authenticated ping API still offers HTTP, DNS and TCP; the free public page probes a URL
-- and nothing else, and adding a second kind to it would be a migration then rather than an
-- unused column now.
--
-- Three tables, three lifetimes:
--
--   leads                kept until it has no watches left. Identity, consent, and the
--                        daily digest's own schedule.
--   trial_watches        kept until `converts_until` (created_at + 30 days) has passed,
--                        because the URL is what a later sign-up converts. Its `expires_at`
--                        (created_at + 7 days) ends the checking, not the row.
--   trial_watch_results  disposable. Deletable once the digests that render them are sent.
--
-- Two deadlines per watch and they are per watch, not per lead: one person can try three
-- URLs on three days, and each attempt is checked for its own week and claimable for its
-- own month. A lead who tried URLs on days 0 and 3 and signs up on day 32 gets a monitor
-- for the second and not the first.
--
-- Nothing here is billed and no Polar customer is created. A lead becomes a customer by
-- signing up, not by trying the tool.

CREATE TABLE `leads` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`email` text NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`locale` text NOT NULL,
	`consented_at` integer,
	`last_digest_at` integer
);
--> statement-breakpoint
-- Email is the natural key. Unique because it is both the conflict target of the
-- create-or-update the trial form runs (a returning visitor updates their row instead of
-- inserting a second one) and the lookup the sign-in path uses to find targets to convert;
-- a duplicate would split one person's watches across two leads and send them two digests
-- a day. Per ADR-010 there is deliberately no `leads_id_unique` index — the `PRIMARY KEY`
-- above already maintains one.
CREATE UNIQUE INDEX `leads_email_unique` ON `leads` (`email`);
--> statement-breakpoint
-- Every trial email's unsubscribe link resolves through this index, and it is the only
-- credential a lead ever holds. Unique so a collision is a write error rather than a request
-- that unsubscribes the wrong person.
CREATE UNIQUE INDEX `leads_unsubscribe_token_unique` ON `leads` (`unsubscribe_token`);
--> statement-breakpoint
-- The cleanup sweep deletes leads that have outlived every watch, and its predicate leads
-- with an age cutoff so that a lead written moments before its first watch cannot be
-- mistaken for an abandoned one.
CREATE INDEX `leads_created_at_idx` ON `leads` (`created_at`);

--> statement-breakpoint
CREATE TABLE `trial_watches` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`lead_id` text(36) NOT NULL,
	`url` text NOT NULL,
	`interval_seconds` integer DEFAULT 3600 NOT NULL,
	`next_due_at` integer,
	`expires_at` integer NOT NULL,
	`converts_until` integer NOT NULL,
	`last_status` text,
	`checks_run` integer DEFAULT 0 NOT NULL,
	`checks_ok` integer DEFAULT 0 NOT NULL,
	`max_response_time_ms` integer DEFAULT 0 NOT NULL,
	`change_notified_at` integer,
	`summary_sent_at` integer,
	`converted_monitor_id` text(36),
	`converted_at` integer
);
--> statement-breakpoint
-- The sweep's whole claim predicate, exactly as on the three monitor tables:
-- `next_due_at IS NOT NULL AND next_due_at <= ?`. NULL means the watch is finished, so no
-- separate "is it still running" column or index is needed. In most minutes this indexed
-- range matches nothing at all, which is what makes running the sweep every minute against
-- an hourly cadence free.
CREATE INDEX `trial_watches_next_due_at_idx` ON `trial_watches` (`next_due_at`);
--> statement-breakpoint
-- Every watch belonging to one lead: the daily digest's per-lead read, the sign-in
-- conversion's read after finding the lead by email, and the "does this lead still have any
-- watches?" existence check the cleanup sweep runs.
CREATE INDEX `trial_watches_lead_idx` ON `trial_watches` (`lead_id`);
--> statement-breakpoint
-- The cleanup sweep's range. `converts_until` and not `expires_at`: a watch whose week is
-- over is still convertible for three more, and deleting on the wrong column would silently
-- take the offer away.
CREATE INDEX `trial_watches_converts_until_idx` ON `trial_watches` (`converts_until`);

--> statement-breakpoint
CREATE TABLE `trial_watch_results` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`trial_watch_id` text(36) NOT NULL,
	`status` text NOT NULL,
	`response_time_ms` integer,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
-- Serves both reads a digest makes — this watch's results newest first, and this watch's
-- results within a time range — from one composite whose leading column is the watch.
CREATE INDEX `trial_watch_results_watch_checked_at_idx` ON `trial_watch_results` (`trial_watch_id`, `checked_at`);
--> statement-breakpoint
-- Retention (ADR-020) deletes across every watch by age, and the composite above cannot
-- seek for it: its leading column is `trial_watch_id`, so a predicate on `checked_at` alone
-- would scan the whole table. This is that sweep's index.
CREATE INDEX `trial_watch_results_checked_at_idx` ON `trial_watch_results` (`checked_at`);
