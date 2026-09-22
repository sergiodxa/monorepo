-- A device with no browser worth using asks for this pair of codes: the one it
-- polls with, and the short one it shows a person to type in somewhere else.
-- Uniqueness on the user code holds only while a code is still undecided, since
-- the alphabet is far too short to stay unique across every code this tenant will
-- ever mint.
CREATE TABLE IF NOT EXISTS device_authorizations (
	id TEXT PRIMARY KEY,
	device_code_hash TEXT NOT NULL UNIQUE,
	user_code TEXT NOT NULL,
	client_id TEXT NOT NULL,
	scopes TEXT NOT NULL,
	interval_s INTEGER NOT NULL DEFAULT 5,
	last_polled_at INTEGER,
	expires_at INTEGER NOT NULL,
	approved_at INTEGER,
	denied_at INTEGER,
	redeemed_at INTEGER,
	subject_id TEXT,
	session_id TEXT,
	auth_time INTEGER,
	amr TEXT,
	token_family_id TEXT,
	created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS device_user_code_pending ON device_authorizations (user_code)
	WHERE approved_at IS NULL AND denied_at IS NULL AND redeemed_at IS NULL;

-- What the daily sweep reads an undecided or never-redeemed row by: one whose ten
-- minutes ran out with no approval and redemption ever landing.
CREATE INDEX IF NOT EXISTS device_authorizations_by_expiry ON device_authorizations (expires_at);

-- What the daily sweep reads a redeemed row by: one old enough that a replay
-- against it is no longer worth keeping the row around to recognize.
CREATE INDEX IF NOT EXISTS device_authorizations_by_redemption ON device_authorizations (redeemed_at);
