-- Every DPoP proof (RFC 9449) the tenant accepted, keyed by its key thumbprint and `jti`,
-- kept until the proof would be too old to accept anyway, so each proof is used once.
CREATE TABLE IF NOT EXISTS dpop_proofs (
	key TEXT PRIMARY KEY,
	expires_at INTEGER NOT NULL
);

-- What the sweep reads a lapsed record by.
CREATE INDEX IF NOT EXISTS dpop_proofs_by_expiry ON dpop_proofs (expires_at);

-- The key a public client's refresh token is bound to (RFC 9449 §5): its thumbprint, or
-- NULL for a token issued without a proof or to a confidential client.
ALTER TABLE refresh_tokens ADD COLUMN jkt TEXT;
