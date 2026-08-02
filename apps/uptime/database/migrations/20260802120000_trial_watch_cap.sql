-- One free watch per person per URL per thirty days
-- The public trial hands an anonymous visitor a week of hourly checks in exchange for an
-- email address, and nothing stopped the same person restarting that week on the same URL
-- forever: `TrialWatch.create` was an unconditional insert and no constraint said otherwise.
-- Three spellings made even a naive check useless — a trailing slash, a fragment or a
-- reordered query string produced a different URL string, and a `+tag` produced a different
-- lead entirely.
--
-- The cap needs no new deadline column. A watch is already deleted thirty days after it was
-- created, on `converts_until`, so "a watch row exists for this lead and this URL" *is* the
-- thirty-day window. What was missing was a key to ask that question with, which is what
-- this migration adds: `leads.normalized_email` and `trial_watches.normalized_url`, each
-- stored beside the value it was derived from and never in place of it. The probe still
-- fetches the URL as typed and the mail still goes to the address as typed.
--
-- Four changes, in the only order that works:
--
--   1. `leads` gains `normalized_email`, and the leads that collapse onto one key are merged
--      before the unique index that would reject them is created.
--   2. `leads` is rebuilt so `normalized_email` is `NOT NULL` and carries the unique index
--      `email` used to, since the deliverable address and the identity key are now two
--      different things and only the second one is unique.
--   3. `trial_watches` gains `normalized_url`, `NOT NULL`, and the composite index the cap's
--      lookup seeks on.
--   4. `trial_watch_results` loses the index its retention sweep no longer uses, because
--      that sweep now follows the watch instead of an age of its own.
--
-- Both tables are rebuilt rather than altered in place. SQLite cannot add a `NOT NULL`
-- column to a populated table without also giving it a default, and a default on either of
-- these columns is worse than the ALTER it saves: an insert that forgot `normalized_email`
-- would silently key as the empty string and collide with the next one, and an insert that
-- forgot `normalized_url` would cap every URL that lead ever submits. The rebuild is the
-- only shape that makes forgetting a write error.

-- The key, on the column it is derived from. Lowercased whole, with any `+tag` cut out of
-- the local part; dots are deliberately kept, because Gmail is the only large provider that
-- ignores them and stripping them would merge `first.last@` and `firstlast@` — two different
-- people almost everywhere else — into one lead.
--
-- `instr` finds the *first* `@`, while the application's own normalizer splits on the last
-- one. They agree for every address in this table: `TrialLeadSchema` validates with an email
-- check, so nothing here carries a second `@` inside a quoted local part.
--
-- The `> 1` guard covers both "no tag" (`instr` returns 0) and "the local part is nothing
-- but a tag" (returns 1), which has no untagged form to reduce to and keeps its local part
-- whole rather than keying as the empty string every such address would share.
ALTER TABLE `leads` ADD COLUMN `normalized_email` text;

--> statement-breakpoint
UPDATE `leads`
   SET `normalized_email` = lower(
	CASE
		WHEN instr(`email`, '@') = 0 THEN `email`
		WHEN instr(substr(`email`, 1, instr(`email`, '@') - 1), '+') > 1
			THEN substr(`email`, 1, instr(substr(`email`, 1, instr(`email`, '@') - 1), '+') - 1)
				|| substr(`email`, instr(`email`, '@'))
		ELSE `email`
	END
);

--> statement-breakpoint
-- Dropped before the merge and not after it, which is not tidying: the merge gives the
-- survivor the address the losing row is still holding, so with this index in place that
-- write is a `UNIQUE` violation and the whole migration fails. The index is going away in any
-- case — from here the address is a delivery detail and `normalized_email` is the identity.
DROP INDEX `leads_email_unique`;

--> statement-breakpoint
-- The collision case, and it is not hypothetical: `hello@x.com` and `hello+news@x.com` are
-- two rows today and one key from here on, so the unique index below would fail on them.
-- They are merged rather than dropped, because each one may own watches somebody is still
-- owed a monitor for.
--
-- The survivor is the oldest row, tie-broken by id so the choice is deterministic on a
-- second run. Oldest and not newest because `created_at` is copied onto `trial_conversions`
-- as when this person first arrived, and `unsubscribe_token` is the link already sitting in
-- their inbox from the first email we ever sent them — both belong to the first row.
--
-- Every watch of a merged-away lead is re-pointed at the survivor first, while the losing
-- rows still exist to be matched. The `IN` guard keeps a watch whose lead is already missing
-- from having its `lead_id` nulled by a subquery that found nothing.
UPDATE `trial_watches`
   SET `lead_id` = (
	SELECT s.`id` FROM `leads` s
	 WHERE s.`normalized_email` = (
		SELECT l.`normalized_email` FROM `leads` l WHERE l.`id` = `trial_watches`.`lead_id`)
	 ORDER BY s.`created_at` ASC, s.`id` ASC
	 LIMIT 1)
 WHERE `lead_id` IN (SELECT `id` FROM `leads`);

--> statement-breakpoint
-- What the survivor inherits, field by field, and none of it is "take the newest row":
--
--   email           the address as last typed, which is the same rule a repeat submission
--                   already follows and the only one that keeps mail deliverable.
--   locale          from the same row as the address, for the same reason.
--   emails_sent     summed. It is a lifetime count of messages this person received, and
--                   they received all of them.
--   consented_at    the earliest non-null. Consent given once is not withdrawn by a later
--                   submission that left the box unticked; `MIN` over nulls ignores them.
--   last_digest_at  the latest. Merging two rows must not entitle the person to a second
--                   digest on a day one of them already had.
--   updated_at      the latest, since this row now stands for both.
UPDATE `leads`
   SET `email` = (
		SELECT d.`email` FROM `leads` d
		 WHERE d.`normalized_email` = `leads`.`normalized_email`
		 ORDER BY d.`updated_at` DESC, d.`id` DESC LIMIT 1),
	`locale` = (
		SELECT d.`locale` FROM `leads` d
		 WHERE d.`normalized_email` = `leads`.`normalized_email`
		 ORDER BY d.`updated_at` DESC, d.`id` DESC LIMIT 1),
	`emails_sent` = (
		SELECT SUM(d.`emails_sent`) FROM `leads` d
		 WHERE d.`normalized_email` = `leads`.`normalized_email`),
	`consented_at` = (
		SELECT MIN(d.`consented_at`) FROM `leads` d
		 WHERE d.`normalized_email` = `leads`.`normalized_email`),
	`last_digest_at` = (
		SELECT MAX(d.`last_digest_at`) FROM `leads` d
		 WHERE d.`normalized_email` = `leads`.`normalized_email`),
	`updated_at` = (
		SELECT MAX(d.`updated_at`) FROM `leads` d
		 WHERE d.`normalized_email` = `leads`.`normalized_email`)
 WHERE `id` IN (
	SELECT s.`id` FROM `leads` s
	 WHERE s.`created_at` = (
		SELECT MIN(x.`created_at`) FROM `leads` x
		 WHERE x.`normalized_email` = s.`normalized_email`)
	   AND s.`id` = (
		SELECT MIN(y.`id`) FROM `leads` y
		 WHERE y.`normalized_email` = s.`normalized_email` AND y.`created_at` = s.`created_at`));

--> statement-breakpoint
-- The losers go once everything they carried has been moved. `NOT IN` over an uncorrelated
-- subquery, so the survivor set is computed once against the table as it stands rather than
-- re-derived row by row while rows are disappearing out from under it.
DELETE FROM `leads`
 WHERE `id` NOT IN (
	SELECT s.`id` FROM `leads` s
	 WHERE s.`created_at` = (
		SELECT MIN(x.`created_at`) FROM `leads` x
		 WHERE x.`normalized_email` = s.`normalized_email`)
	   AND s.`id` = (
		SELECT MIN(y.`id`) FROM `leads` y
		 WHERE y.`normalized_email` = s.`normalized_email` AND y.`created_at` = s.`created_at`));

--> statement-breakpoint
CREATE TABLE `leads_new` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`locale` text NOT NULL,
	`consented_at` integer,
	`last_digest_at` integer,
	`emails_sent` integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
INSERT INTO `leads_new` (`id`, `created_at`, `updated_at`, `email`, `normalized_email`,
	`unsubscribe_token`, `locale`, `consented_at`, `last_digest_at`, `emails_sent`)
SELECT `id`, `created_at`, `updated_at`, `email`, `normalized_email`, `unsubscribe_token`,
	`locale`, `consented_at`, `last_digest_at`, `emails_sent`
  FROM `leads`;

--> statement-breakpoint
DROP TABLE `leads`;

--> statement-breakpoint
ALTER TABLE `leads_new` RENAME TO `leads`;

--> statement-breakpoint
-- The identity key, and the conflict target of the create-or-update the trial form runs. The
-- unique index moves here from `email`, which is now only the address to deliver to: two
-- spellings of one inbox must resolve to one lead, and the address as last typed is a
-- property of that lead rather than its name. Per ADR-010 there is deliberately no
-- `leads_id_unique` index — the `PRIMARY KEY` above already maintains one.
CREATE UNIQUE INDEX `leads_normalized_email_unique` ON `leads` (`normalized_email`);

--> statement-breakpoint
-- Unchanged, and recreated because the rebuild dropped it with the old table. Every trial
-- email's unsubscribe link resolves through this index.
CREATE UNIQUE INDEX `leads_unsubscribe_token_unique` ON `leads` (`unsubscribe_token`);

--> statement-breakpoint
-- Also unchanged: the cleanup sweep's age cutoff for a lead with no watches left.
CREATE INDEX `leads_created_at_idx` ON `leads` (`created_at`);

--> statement-breakpoint
-- The URL's key, backfilled in two passes because the two reductions SQL can express are
-- easier to read apart than nested.
ALTER TABLE `trial_watches` ADD COLUMN `normalized_url` text;

--> statement-breakpoint
UPDATE `trial_watches`
   SET `normalized_url` = CASE
	WHEN instr(`url`, '#') > 0 THEN substr(`url`, 1, instr(`url`, '#') - 1)
	ELSE `url`
   END;

--> statement-breakpoint
-- What this backfill does not do is sort query parameters, which SQL has no way to express.
-- Every URL already in this table came out of `URL` in the trial guard, so its scheme and
-- host are already lowercased and it needs no further reduction unless it carries a query
-- string whose keys happen to be out of order. Such a row keys under its own spelling, so
-- the worst case is that one visitor gets one extra free week on one URL — and the row is
-- deleted within thirty days, after which every key comes from the application's normalizer.
UPDATE `trial_watches`
   SET `normalized_url` = substr(`normalized_url`, 1, length(`normalized_url`) - 1)
 WHERE `normalized_url` LIKE '%/' AND length(`normalized_url`) > 1;

--> statement-breakpoint
CREATE TABLE `trial_watches_new` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`lead_id` text(36) NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
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
INSERT INTO `trial_watches_new` (`id`, `created_at`, `updated_at`, `lead_id`, `url`,
	`normalized_url`, `interval_seconds`, `next_due_at`, `expires_at`, `converts_until`,
	`last_status`, `checks_run`, `checks_ok`, `max_response_time_ms`, `change_notified_at`,
	`summary_sent_at`, `converted_monitor_id`, `converted_at`)
SELECT `id`, `created_at`, `updated_at`, `lead_id`, `url`, `normalized_url`,
	`interval_seconds`, `next_due_at`, `expires_at`, `converts_until`, `last_status`,
	`checks_run`, `checks_ok`, `max_response_time_ms`, `change_notified_at`, `summary_sent_at`,
	`converted_monitor_id`, `converted_at`
  FROM `trial_watches`;

--> statement-breakpoint
DROP TABLE `trial_watches`;

--> statement-breakpoint
ALTER TABLE `trial_watches_new` RENAME TO `trial_watches`;

--> statement-breakpoint
-- Unchanged, and recreated with the table: the sweep's claim predicate.
CREATE INDEX `trial_watches_next_due_at_idx` ON `trial_watches` (`next_due_at`);

--> statement-breakpoint
-- The cap's lookup — "does this lead already have a watch on this URL?" — as one indexed
-- equality rather than a scan of everything they ever tried.
--
-- This replaces `trial_watches_lead_idx` rather than joining it. A composite whose leading
-- column is `lead_id` answers every read the single-column index answered (the daily
-- digest's per-lead read, the sign-in conversion's, and the cleanup sweep's existence
-- check), so keeping both would only mean a second index row written on every submission
-- for nothing. Per ADR-010 the redundant one is not recreated.
CREATE INDEX `trial_watches_lead_normalized_url_idx` ON `trial_watches` (`lead_id`, `normalized_url`);

--> statement-breakpoint
-- Not unique, deliberately. The cap is a lookup the request makes and answers with a report
-- email, so a constraint here would turn the one case it could still catch — two submissions
-- of the same URL racing each other — from a duplicate row into a failed request and a
-- visitor with nothing. The window it leaves open is a fraction of a second, on a page that
-- already requires a rate-limited probe per submission.
--
-- Unchanged: the cleanup sweep's range over the conversion deadline.
CREATE INDEX `trial_watches_converts_until_idx` ON `trial_watches` (`converts_until`);

--> statement-breakpoint
-- Results now live exactly as long as the watch they belong to, and are deleted by following
-- `trial_watch_id` to a watch whose `converts_until` has passed rather than by an age of
-- their own. Nothing reads or sweeps `checked_at` on its own any more — both digest reads
-- lead with the watch id and are served by the composite above it — so this index would only
-- cost a written row per check.
DROP INDEX `trial_watch_results_checked_at_idx`;
