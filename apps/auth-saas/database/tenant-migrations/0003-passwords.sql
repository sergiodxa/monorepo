CREATE TABLE IF NOT EXISTS passwords (
	id TEXT PRIMARY KEY,
	subject_id TEXT NOT NULL,
	hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER,
	must_change INTEGER NOT NULL DEFAULT 0
);

-- What every password lookup reads by: a subject's own rows, newest first, to find
-- the one that authenticates and the rest to derive a reuse check against.
CREATE INDEX IF NOT EXISTS passwords_subject_id_created_at_idx
	ON passwords (subject_id, created_at);

-- One row, its id fixed so the singleton is a lookup by primary key rather than an
-- unbounded table this app has to remember only ever holds one row.
CREATE TABLE IF NOT EXISTS password_policy (
	id TEXT PRIMARY KEY,
	min_length INTEGER NOT NULL DEFAULT 8,
	denied_terms TEXT NOT NULL DEFAULT '[]',
	expiry_interval_ms INTEGER,
	history_depth INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO password_policy (id, min_length, denied_terms, expiry_interval_ms, history_depth)
	VALUES ('default', 8, '[]', NULL, 1);

CREATE TABLE IF NOT EXISTS password_reset_tickets (
	id TEXT PRIMARY KEY,
	subject_id TEXT NOT NULL,
	ticket_hash TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

-- What completing a reset looks the ticket up by; unique because a ticket that
-- collided with another would let one reset spend either.
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tickets_ticket_hash_idx
	ON password_reset_tickets (ticket_hash);
