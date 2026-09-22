-- Magic link sign-in: a token and a code minted together for one address, each
-- stored only as a digest, bound to the browser that asked via a nonce hash
-- carried alongside them. One live attempt per address holds by superseding any
-- prior unconsumed row in code before a new one is minted, so no partial unique
-- index is needed here the way the device user code's pending-only uniqueness is.
CREATE TABLE IF NOT EXISTS magic_link_attempts (
	id TEXT PRIMARY KEY,
	address TEXT NOT NULL,
	subject_id TEXT,
	locale TEXT,
	token_hash TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	browser_nonce_hash TEXT NOT NULL,
	attempts_remaining INTEGER NOT NULL DEFAULT 5,
	expires_at INTEGER NOT NULL,
	consumed_at INTEGER,
	created_at INTEGER NOT NULL
);

-- What a new request's supersede step finds an address's own outstanding row by.
CREATE INDEX IF NOT EXISTS magic_link_attempts_by_address ON magic_link_attempts (address);

-- What the link's `POST` looks its token up by; unique because a token that
-- collided with another would let one completion spend either.
CREATE UNIQUE INDEX IF NOT EXISTS magic_link_attempts_by_token_hash ON magic_link_attempts (token_hash);

-- What a completion (by code) and a cancellation both look the bound browser's
-- own row up by.
CREATE INDEX IF NOT EXISTS magic_link_attempts_by_nonce_hash ON magic_link_attempts (browser_nonce_hash);

-- The object-level burst budget: three requests per fifteen minutes per address,
-- its own small fixed-window counter the way `mail_send_envelopes` counts its
-- hourly and daily windows.
CREATE TABLE IF NOT EXISTS magic_link_bursts (
	address TEXT PRIMARY KEY,
	window_start INTEGER NOT NULL,
	count INTEGER NOT NULL
);

-- Whether an address with no matching subject may become one at completion,
-- the tenant's own setting, off until chosen otherwise.
ALTER TABLE settings ADD COLUMN magic_link_jit_subject_creation INTEGER NOT NULL DEFAULT 0;
