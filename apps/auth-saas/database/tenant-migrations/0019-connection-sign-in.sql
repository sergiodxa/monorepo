-- The identity a subject signed in through once a connection's callback
-- resolved: one row per connection a subject has completed a social sign-in
-- through, keyed by the provider's own subject claim so a returning sign-in
-- resolves the same platform subject rather than minting a second one. The
-- sealed access and refresh tokens are what a later read opens; this
-- migration only carries the columns to write them, since reading one back
-- is a separate call this pass does not build.
CREATE TABLE connection_identities (
	connection_id TEXT NOT NULL,
	provider_subject TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	access_token_sealed TEXT,
	refresh_token_sealed TEXT,
	token_expires_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (connection_id, provider_subject)
);

CREATE INDEX connection_identities_by_subject ON connection_identities (subject_id);

-- A single-use, short-lived ticket naming the session a completed social
-- sign-in already opened, spent on the hostname the flow actually started
-- on once the callback's fixed platform subdomain hands it back. The ticket
-- authorizes nothing itself, the same way a password reset ticket names its
-- own row rather than carrying any permission of its own.
CREATE TABLE connection_handoffs (
	id TEXT PRIMARY KEY,
	ticket_hash TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	session_id TEXT NOT NULL,
	session_token TEXT NOT NULL,
	hostname TEXT NOT NULL,
	authorization_request_id TEXT,
	expires_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX connection_handoffs_ticket_hash_idx ON connection_handoffs (ticket_hash);

CREATE INDEX connection_handoffs_by_expiry ON connection_handoffs (expires_at);
