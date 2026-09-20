-- Social identity provider connections (see connections.ts, connection-catalog.ts):
-- what a tenant configures to let its sign-in page offer a provider a person
-- already holds an account with, either pre-filled from the built-in catalog or
-- supplied from scratch. A connection is created disabled and cannot be enabled
-- without a sealed client secret, so a half-configured provider never appears on
-- a sign-in page. `kind` stays a plain text column rather than a narrow
-- constraint because a connection extends into a directory-routed kind this
-- migration does not build, and a later addition should not have to widen an
-- enum to fit.
CREATE TABLE connections (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	kind TEXT NOT NULL,
	catalog_entry TEXT,
	display_name TEXT NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 0,
	issuer TEXT,
	authorization_endpoint TEXT,
	token_endpoint TEXT,
	userinfo_endpoint TEXT,
	client_id TEXT NOT NULL,
	client_secret_sealed TEXT,
	scopes TEXT NOT NULL,
	subject_claim TEXT NOT NULL,
	email_authority INTEGER NOT NULL,
	auto_link INTEGER NOT NULL DEFAULT 0,
	on_unknown_subject TEXT NOT NULL DEFAULT 'create',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- One row per claim a connection maps into a subject's profile or a declared
-- attribute. `target` is refused at save time unless it names one of those, so
-- a mapping cannot quietly drop a claim for months once it is live. At most one
-- mapping per target, since a second mapping onto the same target would leave
-- which one wins undefined.
CREATE TABLE connection_mappings (
	connection_id TEXT NOT NULL,
	source TEXT NOT NULL,
	target TEXT NOT NULL,
	apply TEXT NOT NULL,
	PRIMARY KEY (connection_id, target)
);

CREATE INDEX connection_mappings_by_connection ON connection_mappings (connection_id);

-- The flow in progress for one sign-in attempt: `state`, the nonce and the PKCE
-- verifier a callback is checked against, and the hostname a cross-host hand
-- back returns to. Nothing in this migration's own module reads or writes this
-- table — it is created now so the schema a connection extends into is whole in
-- one migration, rather than needing a second one later for a single leftover
-- table.
CREATE TABLE connection_transactions (
	id TEXT PRIMARY KEY,
	connection_id TEXT NOT NULL,
	state TEXT NOT NULL,
	nonce TEXT NOT NULL,
	verifier TEXT NOT NULL,
	hostname TEXT NOT NULL,
	authorization_request_id TEXT,
	scopes TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE INDEX connection_transactions_by_connection ON connection_transactions (connection_id);

CREATE INDEX connection_transactions_by_expiry ON connection_transactions (expires_at);
