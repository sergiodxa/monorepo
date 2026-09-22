-- Extends the identity a subject signed in through once (see connection-sign-in.ts,
-- account-linking.ts) with what a resolved sign-in needs to record about how that
-- identity came to be attached to its subject: the provider's own address and
-- whether it asserted that address verified, who or what made the attachment and
-- when, when it last signed somebody in, the scopes it was granted, and the last
-- response's claims for a tenant to inspect when a mapping looks wrong. The table
-- already keys on the connection/provider-subject/subject_id triple this data
-- describes, so it grows rather than a sibling table duplicating that key.
ALTER TABLE connection_identities ADD COLUMN provider_email TEXT;
ALTER TABLE connection_identities ADD COLUMN provider_email_verified INTEGER;
ALTER TABLE connection_identities ADD COLUMN linked_by TEXT NOT NULL DEFAULT 'jit';
ALTER TABLE connection_identities ADD COLUMN linked_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE connection_identities ADD COLUMN last_sign_in_at INTEGER;
ALTER TABLE connection_identities ADD COLUMN granted_scopes TEXT;
ALTER TABLE connection_identities ADD COLUMN claims_json TEXT;

-- Every identity written before this migration was created the same unconditional
-- way this codebase's sign-in flow still creates one, so backfilling those rows as
-- `jit`, linked the moment they were, matches what actually happened rather than
-- leaving a default that names nothing.
UPDATE connection_identities SET linked_at = created_at WHERE linked_at = 0;

-- A subject's identity at one connection has a single answer, the way an external
-- account already has a single subject through the table's own primary key.
CREATE UNIQUE INDEX connection_identities_by_subject_connection ON connection_identities (subject_id, connection_id);

-- A single-use, half-hour ticket naming the one existing subject a sign-in's
-- address matched and the provider identity asking to attach to it, minted when
-- the automatic linking rule's proof falls short and spent once the sign-in page
-- collects a credential that subject already holds. Carries what completing the
-- link later needs to write: the claims a resolved sign-in already mapped, and
-- the provider's refresh token, sealed the same way a completed sign-in seals one.
CREATE TABLE pending_link_tickets (
	id TEXT PRIMARY KEY,
	ticket_hash TEXT NOT NULL,
	connection_id TEXT NOT NULL,
	provider_subject TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	provider_email TEXT,
	provider_email_verified INTEGER,
	granted_scopes TEXT,
	claims_json TEXT,
	refresh_token_sealed TEXT,
	token_expires_at INTEGER,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX pending_link_tickets_ticket_hash_idx ON pending_link_tickets (ticket_hash);

CREATE INDEX pending_link_tickets_by_expiry ON pending_link_tickets (expires_at);
