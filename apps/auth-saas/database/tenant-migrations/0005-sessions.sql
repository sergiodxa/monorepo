CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	token_hash TEXT NOT NULL UNIQUE,
	subject_id TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	auth_time INTEGER NOT NULL,
	last_seen_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	idle_expires_at INTEGER NOT NULL,
	amr TEXT NOT NULL,
	remembered INTEGER NOT NULL,
	ip TEXT,
	user_agent TEXT,
	country TEXT,
	region TEXT,
	city TEXT,
	revoked_at INTEGER,
	revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS sessions_by_subject ON sessions (subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions (expires_at);
