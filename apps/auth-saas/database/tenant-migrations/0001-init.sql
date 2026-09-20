CREATE TABLE IF NOT EXISTS schema_migrations (
	id TEXT PRIMARY KEY,
	applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
	tenant_id TEXT PRIMARY KEY,
	issuer TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
