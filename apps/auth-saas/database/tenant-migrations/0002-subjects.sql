CREATE TABLE IF NOT EXISTS subjects (
	id TEXT PRIMARY KEY,
	status TEXT NOT NULL DEFAULT 'active',
	name TEXT,
	given_name TEXT,
	family_name TEXT,
	nickname TEXT,
	preferred_username TEXT,
	picture TEXT,
	locale TEXT,
	zoneinfo TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subject_identifiers (
	id TEXT PRIMARY KEY,
	subject_id TEXT NOT NULL,
	kind TEXT NOT NULL,
	value TEXT NOT NULL,
	folded TEXT NOT NULL,
	verified_at INTEGER,
	is_primary INTEGER NOT NULL DEFAULT 0,
	verification_ticket TEXT,
	verification_ticket_expires_at INTEGER,
	created_at INTEGER NOT NULL
);

-- The uniqueness rule the whole subjects model hangs off: two rows may never share a
-- folded value of the same kind, which is what makes a folded address or username
-- resolve to exactly one account.
CREATE UNIQUE INDEX IF NOT EXISTS subject_identifiers_kind_folded_idx
	ON subject_identifiers (kind, folded);

CREATE INDEX IF NOT EXISTS subject_identifiers_subject_id_idx
	ON subject_identifiers (subject_id);

-- What the retention sweep reads: unverified rows, oldest first. Partial on verified_at
-- so a subject's proven addresses — the rows that live forever — never sit in the index
-- the sweep walks, and the ticket's expiry rides along as a covering column so the sweep
-- never leaves the index to check whether a row's ticket is still live.
CREATE INDEX IF NOT EXISTS subject_identifiers_unverified_idx
	ON subject_identifiers (created_at, verification_ticket_expires_at)
	WHERE verified_at IS NULL;

CREATE TABLE IF NOT EXISTS subject_attributes (
	subject_id TEXT NOT NULL,
	key TEXT NOT NULL,
	value TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (subject_id, key)
);

-- Per-tenant, not per-subject: what a custom attribute key is allowed to hold and who
-- may read or write it through it.
CREATE TABLE IF NOT EXISTS attribute_definitions (
	key TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	visibility TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
