-- API keys (see api-keys.ts): a long-lived opaque credential an administrative
-- operation mints for one of a tenant's own end users, so that person can script
-- against the tenant's API without driving a browser flow. Verified by a row
-- lookup and a constant-time digest compare on every call rather than a signature
-- check, the way a session's bearer token already is.
CREATE TABLE api_keys (
	id TEXT PRIMARY KEY,
	subject_id TEXT NOT NULL,
	name TEXT NOT NULL,
	secret_hash TEXT NOT NULL,
	hint TEXT NOT NULL,
	scopes TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	last_used_at INTEGER,
	revoked_at INTEGER,
	revoked_reason TEXT
);

CREATE INDEX api_keys_by_subject ON api_keys (subject_id, created_at DESC);

CREATE INDEX api_keys_by_expiry ON api_keys (expires_at);

-- A tenant's own key prefix, chosen once and fixed after, so a presented key's
-- first segment is a literal a secret scanner matches and a reader recognizes in
-- a log. Kept in its own singleton row the way `entitlement_enforcement` keeps
-- one, since this module's own calls carry no tenant id to key a shared row by.
CREATE TABLE api_key_settings (
	id TEXT PRIMARY KEY,
	prefix TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
