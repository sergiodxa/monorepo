-- The keys a client signs its request objects (RFC 9101) with: a key set held inline,
-- or the URL that serves one. A client registered before these columns existed holds
-- neither, and cannot send a signed request object until one is set.
ALTER TABLE clients ADD COLUMN jwks TEXT;
ALTER TABLE clients ADD COLUMN jwks_uri TEXT;

-- Whether a client (RFC 9126 §6), or every client of the tenant (§5), may start an
-- authorization request only through the pushed authorization request endpoint.
ALTER TABLE clients ADD COLUMN require_pushed_authorization_requests INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN require_pushed_authorization_requests INTEGER NOT NULL DEFAULT 0;

-- An authorization request a client pushed, keyed by the SHA-256 of the `request_uri`
-- it was answered with, so a leaked table names no usable reference. Redeeming deletes
-- the row, which is what makes the reference single-use.
CREATE TABLE IF NOT EXISTS pushed_authorization_requests (
	id TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	parameters TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

-- What the daily sweep reads a never-redeemed row by.
CREATE INDEX IF NOT EXISTS pushed_authorization_requests_by_expiry
	ON pushed_authorization_requests (expires_at);
