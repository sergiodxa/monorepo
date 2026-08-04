-- The queue of accounts asked to be deleted, swept once a day.
--
-- Deletion is deferred rather than done on the click, and the row is the whole mechanism:
--
--   * It is the retry policy. The sweep deletes the row only after the erasure finished and
--     the confirmation mail was accepted, so a run that failed halfway — Polar unreachable,
--     a transport refusal — leaves it exactly where it was and tomorrow's run tries again.
--     There is no attempt counter and no backoff column, because "it failed" and "it will be
--     retried tomorrow" are the same statement here.
--   * It is the grace period. Up to a day passes before anything is deleted, which is not a
--     concession to running the sweep daily: it is the window in which somebody who clicked
--     by mistake signs back in and cancels. Cancelling deletes this row, and a row that is
--     gone simply is not swept.
--
-- `email` is on the row, and this is the one table in the schema whose purpose forces it.
-- Nothing else here stores an account holder's address: an account is an OIDC subject,
-- `invites.email` belongs to an invitee and `leads.email` to a trial visitor, and the holder's
-- own address lives only in the ID token on the request. Without capturing it at request time
-- there is no address left to send "your account has been deleted" to once the account is
-- gone. An erasure request is therefore the one thing that must store an address in order to
-- be fulfilled — and this row, the only copy, is deleted at the end of the erasure it enables.
--
-- No index beyond the unique constraint (ADR-010). The sweep reads the whole table, which is
-- empty on almost every run and holds a handful of rows on the others, and the only other
-- query — "does this viewer already have one" — is the unique constraint's own lookup.
CREATE TABLE `account_deletions` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`subject_id` text NOT NULL,
	`email` text NOT NULL,
	`requested_at` integer NOT NULL
);
--> statement-breakpoint
-- One request per subject: the form's insert is an upsert against this constraint, so a second
-- submission (a double-click, a resubmitted form) is the same request rather than a duplicate
-- the sweep would process twice.
CREATE UNIQUE INDEX `account_deletions_subject_unique` ON `account_deletions` (`subject_id`);
