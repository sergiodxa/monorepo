-- A pending interaction: the request `/authorize` validated, parked under an opaque id
-- while a person signs in or decides on consent, until it is redeemed for a code or its
-- own ten-minute window runs out.
CREATE TABLE IF NOT EXISTS authorization_requests (
	id TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	redirect_uri TEXT NOT NULL,
	response_type TEXT NOT NULL,
	scopes TEXT NOT NULL,
	state TEXT,
	nonce TEXT,
	code_challenge TEXT NOT NULL,
	code_challenge_method TEXT NOT NULL,
	prompt TEXT,
	max_age INTEGER,
	login_hint TEXT,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

-- What the daily sweep reads by: every pending interaction ordered by how soon it lapses.
CREATE INDEX IF NOT EXISTS authorization_requests_by_expiry ON authorization_requests (expires_at);

-- The four bindings the token endpoint checks a redemption against, what a token is
-- minted from, and the redemption's own bookkeeping. The code itself never touches this
-- table: only its digest does, the same way a session or a password reset ticket stores
-- a hash and nothing that could be replayed from a copy of this row.
CREATE TABLE IF NOT EXISTS authorization_codes (
	id TEXT PRIMARY KEY,
	code_hash TEXT NOT NULL UNIQUE,
	client_id TEXT NOT NULL,
	redirect_uri TEXT NOT NULL,
	code_challenge TEXT NOT NULL,
	scopes TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	session_id TEXT NOT NULL,
	nonce TEXT,
	auth_time INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	redeemed_at INTEGER,
	token_family_id TEXT
);

-- What the daily sweep reads an unredeemed row by: one whose sixty seconds ran out with
-- no exchange ever landing.
CREATE INDEX IF NOT EXISTS authorization_codes_by_expiry ON authorization_codes (expires_at);

-- What the daily sweep reads a redeemed row by: one old enough that a replay against it
-- is no longer worth keeping the row around to recognize.
CREATE INDEX IF NOT EXISTS authorization_codes_by_redemption ON authorization_codes (redeemed_at);
