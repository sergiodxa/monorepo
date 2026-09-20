-- A refresh token: single-use once rotated, chained to the token it replaced by
-- `parent_hash`, and grouped with every other token minted from the same
-- authorization by `family_id`. Keyed by its own digest directly, the same lookup
-- a redemption runs by, rather than a separate row id nothing else references.
-- Only the digest is stored, the same way a session or an authorization code
-- stores a hash and nothing a copy of this row could replay.
CREATE TABLE IF NOT EXISTS refresh_tokens (
	token_hash TEXT PRIMARY KEY,
	family_id TEXT NOT NULL,
	parent_hash TEXT,
	client_id TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	session_id TEXT NOT NULL,
	scopes TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	absolute_expires_at INTEGER NOT NULL,
	redeemed_at INTEGER,
	revoked_at INTEGER
);

-- What a reuse response revokes by, and what a rotation's own family lineage reads.
CREATE INDEX IF NOT EXISTS refresh_tokens_by_family ON refresh_tokens (family_id);

-- What the daily sweep reads by: every row whose family is past its ninety-day ceiling.
CREATE INDEX IF NOT EXISTS refresh_tokens_by_absolute_expiry ON refresh_tokens (absolute_expires_at);
