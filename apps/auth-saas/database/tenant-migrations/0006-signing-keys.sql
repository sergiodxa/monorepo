CREATE TABLE IF NOT EXISTS signing_keys (
	id TEXT PRIMARY KEY,
	alg TEXT NOT NULL,
	public_key TEXT NOT NULL,
	private_key TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	signing_from INTEGER,
	retired_at INTEGER,
	publish_until INTEGER
);

-- What advanceSigningKeys reads to find the one key `sign` would pick right now.
CREATE INDEX IF NOT EXISTS signing_keys_currently_signing_idx
	ON signing_keys (signing_from)
	WHERE signing_from IS NOT NULL AND retired_at IS NULL;

-- What advanceSigningKeys and publishKeySet both read to render the published set: every
-- row without a publish window yet (staged or signing) or whose window has not passed.
CREATE INDEX IF NOT EXISTS signing_keys_publish_until_idx ON signing_keys (publish_until);

CREATE TABLE IF NOT EXISTS custom_claims (
	name TEXT PRIMARY KEY,
	attribute_key TEXT NOT NULL,
	placement TEXT NOT NULL,
	scope TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
