-- The tokens a reader mints for an agent, and the daily budget every agent request spends.
--
-- A token names itself: the signed value carries the reader's subject and this row's id, so
-- verifying it yields the object to open with no index anywhere that every reader shares.
-- What the row holds is everything that can change after it was minted — the scope, the
-- expiry, the revocation — so none of it can go stale inside a credential in a config file.
--
-- `hash` is a SHA-256 of the signature segment, which is what lets this page name a token
-- back to the reader while holding nothing anybody could replay.
CREATE TABLE tokens (
	id TEXT PRIMARY KEY,
	-- What the reader called it, so a row they no longer recognize is a row they can revoke.
	name TEXT NOT NULL,
	-- `read` lists no writing tool at all; `write` is what an agent that marks posts needs.
	scope TEXT NOT NULL CHECK (scope IN ('read', 'write')),
	hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	-- Stamped at most hourly, so recognizing a forgotten token costs no write per call.
	last_used_at INTEGER,
	expires_at INTEGER NOT NULL,
	revoked_at INTEGER
);

-- The list, newest first, which is the order the settings page reads them in. The id breaks
-- a tie between two minted in the same millisecond.
CREATE INDEX tokens_created_at_idx ON tokens (created_at, id);

-- One row per agent request, which is what bounds a per-account bill: the platform's own
-- limiter counts per location, so an agent spread across regions slips it and this does not.
-- The index carries both columns in query order, because every read is "this bucket, since
-- this instant".
CREATE TABLE rate_limit_hits (
	id TEXT PRIMARY KEY,
	bucket TEXT NOT NULL,
	cost INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX rate_limit_hits_bucket_created_at_idx ON rate_limit_hits (bucket, created_at);
