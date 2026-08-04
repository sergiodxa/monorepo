-- An address for one watch's seven-day report
-- The report existed only as an email, which means it existed only for as long as the
-- message stayed findable. `GET /try/report/:token` makes it a page a reader can reopen,
-- forward, or arrive at from the email weeks later, and this column is the whole of its
-- addressing: nobody behind a trial has an account, so the URL is the only credential
-- available.
--
-- It is a *new* token rather than the lead's `unsubscribe_token`, which the trial emails
-- already carry and which would have needed no migration at all. That token acts — one POST
-- to it deletes the address and every watch under it — and a report is a thing people forward
-- to a colleague or a client. One token doing both jobs would make sharing a page equivalent
-- to handing over the power to delete the reader's data, and a per-watch token also keeps a
-- leaked link to the single URL it reports on.
--
-- ## The backfill
--
-- Every existing row gets its own fresh random token from `hex(randomblob(16))` — 128 bits,
-- evaluated per row, so the values are unguessable and collide with vanishing probability
-- under the unique index created below. The three alternatives were all worse:
--
--   leave them NULL      the column could then never be `NOT NULL`, and a watch with no
--                        token is one whose wrap-up email has no report to link to. The rows
--                        being backfilled are precisely the live watches whose seven days
--                        have not finished yet.
--   derive from `id`     the id is a UUID this table already keys on and hands to other
--                        tables; deriving the public URL from it would make the report
--                        reachable from anywhere an id is ever exposed, and would tie two
--                        unrelated capabilities to one secret.
--   reuse the lead's     rejected above, and it is not even unique here: a lead with three
--   unsubscribe token    watches would give all three the same report URL.
--
-- The backfilled tokens are 32 hex characters where `TrialWatch.create` writes a UUID. Both
-- are opaque random strings that are only ever compared for equality, never parsed, so the
-- shapes are free to differ and every row written from here on has the application's form.
--
-- ## Why the table is rebuilt
--
-- SQLite cannot add a `NOT NULL` column to a populated table without a default, and a
-- default on this column is worse than the rebuild it saves: an insert that forgot the token
-- would key as the empty string, and the *second* such insert would fail the unique index
-- with a message pointing nowhere near the code that omitted it. Rebuilding is the only shape
-- that makes forgetting the write a compile-and-insert error rather than a latent collision.
-- The rebuild is safe on a populated table — the rows are copied before the old table is
-- dropped — and the table is small by construction: a watch is deleted thirty days after it
-- was created.

ALTER TABLE `trial_watches` ADD COLUMN `report_token` text;

--> statement-breakpoint
-- `randomblob` is evaluated once per row, so this is one distinct token each and not one
-- token repeated. The `IS NULL` guard is what makes a re-run of this statement a no-op
-- instead of rotating every token that has already been emailed.
UPDATE `trial_watches`
   SET `report_token` = lower(hex(randomblob(16)))
 WHERE `report_token` IS NULL;

--> statement-breakpoint
CREATE TABLE `trial_watches_new` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`lead_id` text(36) NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`report_token` text NOT NULL,
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
	`normalized_url`, `report_token`, `interval_seconds`, `next_due_at`, `expires_at`,
	`converts_until`, `last_status`, `checks_run`, `checks_ok`, `max_response_time_ms`,
	`change_notified_at`, `summary_sent_at`, `converted_monitor_id`, `converted_at`)
SELECT `id`, `created_at`, `updated_at`, `lead_id`, `url`, `normalized_url`, `report_token`,
	`interval_seconds`, `next_due_at`, `expires_at`, `converts_until`, `last_status`,
	`checks_run`, `checks_ok`, `max_response_time_ms`, `change_notified_at`, `summary_sent_at`,
	`converted_monitor_id`, `converted_at`
  FROM `trial_watches`;

--> statement-breakpoint
DROP TABLE `trial_watches`;

--> statement-breakpoint
ALTER TABLE `trial_watches_new` RENAME TO `trial_watches`;

--> statement-breakpoint
-- Unchanged, and recreated because the rebuild dropped them with the old table: the sweep's
-- claim predicate, the free-watch cap's lookup, and the cleanup sweep's range over the
-- conversion deadline.
CREATE INDEX `trial_watches_next_due_at_idx` ON `trial_watches` (`next_due_at`);

--> statement-breakpoint
CREATE INDEX `trial_watches_lead_normalized_url_idx` ON `trial_watches` (`lead_id`, `normalized_url`);

--> statement-breakpoint
CREATE INDEX `trial_watches_converts_until_idx` ON `trial_watches` (`converts_until`);

--> statement-breakpoint
-- The report page's only read: a token, with no lead and no session to narrow it. Unique
-- because two watches sharing one report URL would mean one of them is unreachable and the
-- other reports on a URL the reader did not ask about. Per ADR-010 there is deliberately no
-- `trial_watches_id_unique` index — the `PRIMARY KEY` above already maintains one.
CREATE UNIQUE INDEX `trial_watches_report_token_unique` ON `trial_watches` (`report_token`);
