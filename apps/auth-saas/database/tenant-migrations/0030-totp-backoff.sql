-- Per-subject authentication backoff for the second factor (see totp.ts): the
-- same consecutive-failure counter and unlock timestamp `0029` already carries
-- on a password row, carried here on the one TOTP factor row a subject holds,
-- plus when that counter was last touched so an old run of failures can be
-- told apart from a fresh one.
ALTER TABLE totp_factors ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE totp_factors ADD COLUMN retry_after INTEGER;
ALTER TABLE totp_factors ADD COLUMN last_failure_at INTEGER;
