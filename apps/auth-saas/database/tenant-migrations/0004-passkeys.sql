CREATE TABLE IF NOT EXISTS passkeys (
	credential_id TEXT PRIMARY KEY,
	subject_id TEXT NOT NULL,
	public_key TEXT NOT NULL,
	algorithm INTEGER NOT NULL,
	counter INTEGER NOT NULL,
	transports TEXT NOT NULL,
	aaguid TEXT,
	label TEXT NOT NULL,
	syncable INTEGER NOT NULL,
	backed_up INTEGER NOT NULL,
	suspended INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL,
	last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS passkeys_subject_id_idx ON passkeys (subject_id);

CREATE TABLE IF NOT EXISTS passkey_challenges (
	ceremony_id TEXT PRIMARY KEY,
	kind TEXT NOT NULL,
	subject_id TEXT,
	challenge TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);

-- What the sweep reads: every row ordered by how soon it expires, so a caller can
-- clear everything past a cutoff without scanning rows the ceremony they belong to
-- is still waiting on.
CREATE INDEX IF NOT EXISTS passkey_challenges_expires_at_idx ON passkey_challenges (expires_at);
