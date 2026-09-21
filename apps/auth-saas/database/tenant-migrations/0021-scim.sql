-- SCIM provisioning connections (see scim.ts): the bearer-token-authenticated
-- directory sync channel through which an identity provider creates, updates,
-- deactivates and deletes this tenant's subjects. A token is minted once and
-- stored only as its digest; a rotation keeps the outgoing token verifying
-- for up to 72 hours so an administrator has a window to paste the new one
-- in, which is what `previous_token_hash` and its expiry hold.
CREATE TABLE scim_connections (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	previous_token_hash TEXT,
	previous_token_expires_at INTEGER,
	on_delete TEXT NOT NULL DEFAULT 'block',
	group_sync INTEGER NOT NULL DEFAULT 0,
	last_request_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX scim_connections_by_previous_token_hash ON scim_connections (previous_token_hash);

-- One directory group synced through a connection. A group grants nothing on
-- its own — membership only means something once `scim_group_mappings`
-- names what the group stands for.
CREATE TABLE scim_groups (
	id TEXT PRIMARY KEY,
	connection_id TEXT NOT NULL,
	display_name TEXT NOT NULL,
	external_id TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX scim_groups_by_connection ON scim_groups (connection_id);

CREATE UNIQUE INDEX scim_groups_by_connection_external_id ON scim_groups (connection_id, external_id)
WHERE
	external_id IS NOT NULL;

-- One subject's membership in one synced group.
CREATE TABLE scim_group_members (
	group_id TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (group_id, subject_id)
);

CREATE INDEX scim_group_members_by_subject ON scim_group_members (subject_id);

-- What a synced group stands for: a role or an organization, recorded as
-- plain data naming the target's kind and id. Neither target table exists in
-- this codebase yet, so nothing here validates or acts on the reference —
-- the same deferred-dependency shape already used elsewhere, kept ready for
-- the addition that reads it.
CREATE TABLE scim_group_mappings (
	group_id TEXT NOT NULL,
	connection_id TEXT NOT NULL,
	target_kind TEXT NOT NULL,
	target_id TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (group_id, target_kind, target_id)
);

CREATE INDEX scim_group_mappings_by_connection ON scim_group_mappings (connection_id);

-- Ties one connection's own externalId to the platform subject it
-- provisioned or adopted. `last_digest` is the mapped-attribute digest a
-- replace compares against, so a periodic full resync of an unchanged
-- directory writes nothing.
CREATE TABLE scim_links (
	connection_id TEXT NOT NULL,
	external_id TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	last_digest TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (connection_id, external_id)
);

CREATE UNIQUE INDEX scim_links_by_connection_subject ON scim_links (connection_id, subject_id);
