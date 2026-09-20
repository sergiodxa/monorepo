-- TOTP second factor and recovery codes (see totp.ts): the tenant's own record of
-- an authenticator enrolment awaiting proof, the one active factor a subject holds,
-- the replay guard for a submitted code, the backup codes issued alongside a
-- factor, and the browsers that have proven the factor recently enough to skip it
-- again. `settings` gains the per-tenant factor policy alongside them, since a
-- tenant with no policy row written yet still needs a default to enforce, and
-- `subjects` gains the flag an administrator reset sets to demand a fresh
-- enrolment at the next sign-in.
ALTER TABLE settings ADD COLUMN mfa_policy TEXT NOT NULL DEFAULT 'optional';

ALTER TABLE subjects ADD COLUMN mfa_reset_required INTEGER NOT NULL DEFAULT 0;

CREATE TABLE totp_enrolments (
	enrolment_id TEXT PRIMARY KEY,
	subject_id TEXT NOT NULL,
	sealed_secret TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE INDEX totp_enrolments_by_subject ON totp_enrolments (subject_id);

CREATE INDEX totp_enrolments_by_expiry ON totp_enrolments (expires_at);

CREATE TABLE totp_factors (
	subject_id TEXT PRIMARY KEY,
	sealed_secret TEXT NOT NULL,
	label TEXT NOT NULL,
	activated_at INTEGER NOT NULL,
	last_used_at INTEGER
);

-- `code_hash` never repeats for the same subject inside the drift window a claim
-- guards, so the pair is the primary key rather than a separate id column.
CREATE TABLE totp_claims (
	subject_id TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	at INTEGER NOT NULL,
	PRIMARY KEY (subject_id, code_hash)
);

CREATE INDEX totp_claims_by_time ON totp_claims (at);

CREATE TABLE recovery_codes (
	subject_id TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	used_at INTEGER,
	PRIMARY KEY (subject_id, code_hash)
);

CREATE INDEX recovery_codes_by_subject ON recovery_codes (subject_id);

CREATE TABLE trusted_devices (
	id TEXT PRIMARY KEY,
	subject_id TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	ip TEXT,
	user_agent TEXT
);

CREATE INDEX trusted_devices_by_subject ON trusted_devices (subject_id);

CREATE INDEX trusted_devices_by_expiry ON trusted_devices (expires_at);
