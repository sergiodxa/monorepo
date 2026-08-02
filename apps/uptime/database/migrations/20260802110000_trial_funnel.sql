-- Instrumentation for the public trial's conversion funnel: how many emails a lead was
-- actually sent, a durable record of the ones who went on to sign up and to pay, and a
-- per-day snapshot of the counters a report is drawn from.
--
-- The question none of the existing tables can answer is "somebody used the free form, gave
-- us an address, received A emails, and B days later became a paying customer". `leads` and
-- `trial_watches` hold the front of that sentence and lose it on a thirty-day clock;
-- `subscriptions` holds the end of it and has never heard of a lead. Three additions close
-- the gap, and each has a different lifetime on purpose:
--
--   leads.emails_sent    a counter on the lead, so it dies with the lead. It is the "A".
--   trial_conversions    one row per converted account, written at sign-up out of facts
--                        copied off the lead. Outlives every trial row and is never swept.
--   trial_daily_stats    one immutable row per reported day, written by the report job.
--
-- `trial_daily_stats` exists because the other two cannot be recomputed later. Leads and
-- watches are deleted thirty days on, and an unsubscribe deletes a lead's whole history
-- retroactively, so a query run in September over August would quietly return a smaller
-- number than the same query run in August — history that rewrites itself is worse than no
-- history. A row written on the day is the only thing that stays true.

ALTER TABLE `leads` ADD COLUMN `emails_sent` integer DEFAULT 0 NOT NULL;

--> statement-breakpoint
-- One converted account, keyed on the OIDC subject rather than on the address it was
-- matched by, and written out of a lead rather than pointing at one.
--
-- Both of those are the same decision. Unsubscribing deletes every trace of a lead — that
-- is the promise `Lead.forget` makes and it must keep holding — so a foreign key to a lead
-- would either be broken by an unsubscribe or would stop one from being honoured. A person
-- who signed up is no longer a lead in any case: they are a customer, and the address they
-- gave the free form is now the least interesting thing known about them. The subject is
-- also `teams.owner_id` and therefore `subscriptions.external_customer_id`, so this table
-- joins to billing with no hop through anything that expires.
--
-- Everything a lead contributed is copied in at sign-up, never read back through a join,
-- for exactly the same reason: the rows it was copied from are gone thirty days later.
CREATE TABLE `trial_conversions` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`owner_id` text NOT NULL,
	`lead_created_at` integer NOT NULL,
	`emails_sent` integer DEFAULT 0 NOT NULL,
	`watch_count` integer DEFAULT 0 NOT NULL,
	`urls` text NOT NULL,
	`signed_up_at` integer NOT NULL,
	`paid_at` integer
);
--> statement-breakpoint
-- One row per account, which is what makes the sign-in path's write an upsert instead of a
-- read-then-insert: conversion runs on every sign-in, so the second one must find this
-- constraint rather than insert a duplicate that would double every count drawn from here.
-- Per ADR-010 there is deliberately no `trial_conversions_id_unique` index — the
-- `PRIMARY KEY` above already maintains one.
CREATE UNIQUE INDEX `trial_conversions_owner_unique` ON `trial_conversions` (`owner_id`);
--> statement-breakpoint
-- The report's two reads: the accounts that signed up in a window, and the ones that paid
-- in it. Separate indexes and not a composite, because the two dates move independently —
-- an account signs up in March and pays in May, and neither query constrains the other
-- column.
CREATE INDEX `trial_conversions_signed_up_at_idx` ON `trial_conversions` (`signed_up_at`);
--> statement-breakpoint
CREATE INDEX `trial_conversions_paid_at_idx` ON `trial_conversions` (`paid_at`);

--> statement-breakpoint
-- One day of the funnel as it was counted on the morning after, and never recounted.
--
-- Written by the report job for the day it reports, whether or not an email goes out, so a
-- quiet day is recorded as a zero rather than as a gap. The counters are the same five the
-- email shows, which is the point: the thirty-day context in the report is a sum over these
-- rows, and it has to be a sum over what was reported rather than a re-query of tables that
-- have since been swept.
CREATE TABLE `trial_daily_stats` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`date` text NOT NULL,
	`new_leads` integer DEFAULT 0 NOT NULL,
	`urls_checked` integer DEFAULT 0 NOT NULL,
	`emails_sent` integer DEFAULT 0 NOT NULL,
	`free_signups` integer DEFAULT 0 NOT NULL,
	`paid_conversions` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- The day is the key, so a re-run of the job — a redelivered queue message, a manual
-- replay — overwrites the day it recomputed instead of adding a second row that every
-- later sum would double. It is also the range the thirty-day totals scan.
CREATE UNIQUE INDEX `trial_daily_stats_date_unique` ON `trial_daily_stats` (`date`);
