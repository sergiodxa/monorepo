-- Persistence for the two digests a team's members receive: which of those emails a person
-- has turned off, and when each membership was last sent one.
--
-- Two additions, on two different tables, because the feature has two different units.
--
--   user_preferences.unsubscribed_emails   the choice belongs to the person, not to a team.
--                                          Somebody in three teams turns the daily digest
--                                          off once and it stops for all three, which is
--                                          what a setting on the account page promises.
--   memberships.last_*_digest_at           the delivery belongs to the pair. One person in
--                                          three teams gets three emails, so the stamp that
--                                          keeps a redelivered trigger from sending a second
--                                          copy has to be per membership: a stamp on the
--                                          subject would suppress two of the three, and one
--                                          on the team would suppress every member but the
--                                          first.
--
-- The opt-out is stored as the list of emails a member does NOT want rather than as a boolean
-- per email. Both are the same information, and the difference is what happens when a third
-- digest is added: a JSON list needs no migration and no column, only an entry in
-- `optionalEmails` in `database/schema.ts`. It also makes the default — subscribed — the
-- absence of data, so a member who has never opened the settings page needs no row at all.
-- The values are the `optionalEmails` strings, which is why the column is text and not an
-- enum SQLite could enforce; the enum lives in the schema module, next to the list the
-- settings page renders from.

ALTER TABLE `user_preferences` ADD COLUMN `unsubscribed_emails` text;

--> statement-breakpoint
-- When this membership was last sent each digest, or NULL for one that never has been.
--
-- These are the same guard `leads.last_digest_at` is for the free watches: the job selects
-- only memberships whose stamp predates today's UTC midnight and writes the stamp only after
-- a send the transport accepted, so a cron trigger delivered twice — or a queue message
-- redelivered after a failure — finds the work already done instead of mailing a second copy.
-- A send that failed leaves the stamp alone and is retried by the next delivery.
--
-- Deliberately unindexed. The digest job reads every membership in the table on purpose, since
-- every team gets a digest, so an index on either column would be a written row per member per
-- day that no query ever reads (ADR-010's reasoning, applied before the index exists).
ALTER TABLE `memberships` ADD COLUMN `last_daily_digest_at` integer;

--> statement-breakpoint
ALTER TABLE `memberships` ADD COLUMN `last_weekly_digest_at` integer;
