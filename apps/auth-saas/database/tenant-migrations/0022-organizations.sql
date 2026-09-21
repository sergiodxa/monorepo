-- Organizations (see organizations.ts): a tenant's own customers, distinct from the
-- tenant itself — the rows a business's people join, invite each other into, and earn
-- membership in automatically once their employer's email domain is verified.
CREATE TABLE organizations (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	logo_url TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	metadata TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- One subject's membership in one organization. `role` holds whatever string a caller
-- gives it — the role vocabulary is a later addition's job, not this table's — and
-- `joined_via` records how the membership came to exist.
CREATE TABLE organization_members (
	organization_id TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	role TEXT NOT NULL,
	joined_via TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (organization_id, subject_id)
);

CREATE INDEX organization_members_by_subject ON organization_members (subject_id, created_at);

-- A bearer ticket inviting one address to one organization. `token_hash` is the only
-- form the token is ever stored in. The partial unique index keeps one address to one
-- open invitation per organization while letting its accepted and revoked history pile
-- up beside it rather than being deleted.
CREATE TABLE organization_invitations (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	folded_email TEXT NOT NULL,
	role TEXT NOT NULL,
	invited_by TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at INTEGER NOT NULL,
	accepted_at INTEGER,
	revoked_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX organization_invitations_open_by_org_email ON organization_invitations (organization_id, folded_email)
WHERE
	accepted_at IS NULL
	AND revoked_at IS NULL;

CREATE INDEX organization_invitations_by_expiry ON organization_invitations (expires_at);

-- A domain an organization has claimed, proven by the DNS TXT record the tenant
-- publishes at `verification_value`. The domain itself is the primary key, so two
-- organizations in one tenant cannot both claim it.
CREATE TABLE organization_domains (
	domain TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	mode TEXT NOT NULL,
	verification_value TEXT NOT NULL,
	verified_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE INDEX organization_domains_by_organization ON organization_domains (organization_id);

-- The organization a session is currently acting for, read by token minting to fill in
-- its `org` claim. Nullable, since most sessions never select one.
ALTER TABLE sessions ADD COLUMN active_organization_id TEXT;

CREATE INDEX sessions_by_active_organization ON sessions (active_organization_id);
