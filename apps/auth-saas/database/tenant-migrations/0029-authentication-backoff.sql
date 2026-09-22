-- Per-subject authentication backoff (see passwords.ts): a consecutive-failure
-- counter and the timestamp it unlocks at, carried on the same row a sign-in
-- already reads and writes, plus when that counter was last touched so an old
-- run of failures can be told apart from a fresh one. `settings` gains the
-- tenant's own threshold for how many failures a counter reaches before it
-- starts a backoff, the same way it already carries a per-tenant MFA policy.
ALTER TABLE passwords ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE passwords ADD COLUMN retry_after INTEGER;
ALTER TABLE passwords ADD COLUMN last_failure_at INTEGER;

ALTER TABLE settings ADD COLUMN failure_threshold INTEGER NOT NULL DEFAULT 4;
