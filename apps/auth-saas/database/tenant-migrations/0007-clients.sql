CREATE TABLE IF NOT EXISTS clients (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	kind TEXT NOT NULL,
	redirect_uris TEXT NOT NULL,
	post_logout_redirect_uris TEXT NOT NULL,
	grant_types TEXT NOT NULL,
	response_types TEXT NOT NULL,
	scopes TEXT NOT NULL,
	token_endpoint_auth_method TEXT NOT NULL,
	require_consent INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	disabled_at INTEGER
);

CREATE TABLE IF NOT EXISTS client_secrets (
	id TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	hash TEXT NOT NULL,
	hint TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	last_used_at INTEGER,
	expires_at INTEGER
);

-- What minting or verifying a secret reads by: every row belonging to one client.
CREATE INDEX IF NOT EXISTS client_secrets_by_client ON client_secrets (client_id);

-- What the daily sweep reads by: every row ordered by how soon its window closes.
CREATE INDEX IF NOT EXISTS client_secrets_by_expiry ON client_secrets (expires_at);
