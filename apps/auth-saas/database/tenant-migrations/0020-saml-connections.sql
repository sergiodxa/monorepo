-- The SAML half of a connection whose kind is `saml`: the identity provider's
-- own entity id and sign-on endpoints, the metadata URL a refresh re-reads them
-- from, and the service provider's own key pair, generated once at first save
-- and kept here because the private half is what opens an encrypted assertion
-- and what signs a request. One row per connection, so the `connections` table
-- carries no column a social provider would leave null.
CREATE TABLE connection_saml (
	connection_id TEXT PRIMARY KEY,
	idp_entity_id TEXT NOT NULL,
	sso_redirect_url TEXT,
	sso_post_url TEXT,
	metadata_url TEXT,
	want_assertions_encrypted INTEGER NOT NULL DEFAULT 0,
	allow_idp_initiated INTEGER NOT NULL DEFAULT 0,
	sp_private_key_sealed TEXT NOT NULL,
	sp_certificate TEXT NOT NULL,
	sp_certificate_not_after INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- The certificates a connection trusts, as a set rather than as one, because an
-- identity provider's signing certificate expires on a date and rotates on a
-- schedule the tenant does not control. A certificate absent from a refreshed
-- metadata document is retired rather than deleted, so a blip at the provider
-- locks nobody out, and the validity window is what a sweep reads to announce an
-- expiry before it stops verifying anything.
CREATE TABLE connection_certificates (
	connection_id TEXT NOT NULL,
	use TEXT NOT NULL,
	fingerprint TEXT NOT NULL,
	certificate TEXT NOT NULL,
	not_before INTEGER NOT NULL,
	not_after INTEGER NOT NULL,
	source TEXT NOT NULL,
	retired_at INTEGER,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (connection_id, use, fingerprint)
);

CREATE INDEX connection_certificates_by_expiry ON connection_certificates (not_after);

-- Every assertion id already accepted, held until the assertion's own window
-- closes. A bearer assertion is replayable for as long as that window is open,
-- and the primary key is what closes it: a second insert of the same id fails
-- the constraint, which is the answer rather than a read followed by a write.
CREATE TABLE saml_assertion_ids (
	connection_id TEXT NOT NULL,
	assertion_id TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	PRIMARY KEY (connection_id, assertion_id)
);

CREATE INDEX saml_assertion_ids_by_expiry ON saml_assertion_ids (expires_at);

-- The sign-in in flight against a SAML connection. The row's own id is what
-- travels as `RelayState` and comes back with the response, which is how the
-- assertion is matched to a request without reading anything out of a document
-- that has not been verified yet; `request_id` is the value the assertion then
-- has to name, checked as part of that verification rather than before it.
CREATE TABLE saml_transactions (
	id TEXT PRIMARY KEY,
	connection_id TEXT NOT NULL,
	request_id TEXT NOT NULL,
	hostname TEXT NOT NULL,
	authorization_request_id TEXT,
	expires_at INTEGER NOT NULL
);

CREATE INDEX saml_transactions_by_expiry ON saml_transactions (expires_at);
