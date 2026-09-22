-- A control-plane invitation to administer a tenant's dashboard by email, filling the
-- gap the direct-grant `POST /tenants/:tenantId/members` route leaves for an address
-- with no platform dashboard account yet (see app/models/tenant-member-invitation.ts).
-- Lives alongside `tenant_import_runs` and `tenant_export_runs` rather than inside a
-- tenant's own object, since what it names — access to the platform's own dashboard
-- for this tenant — is a control-plane fact, not a directory entry.
--
-- The partial unique index keeps one address to one open invitation per tenant, the
-- same shape `device_user_code_pending` already gives a device authorization's own
-- user code; the invite route itself deletes any prior unaccepted invitation for the
-- same tenant and address before minting a new one, the same supersede-before-insert
-- idiom `magic_link_attempts` already follows, so the index enforces the invariant the
-- route's own delete keeps satisfied rather than ever needing to refuse a caller with it.
CREATE TABLE tenant_member_invitations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX tenant_member_invitations_open_by_tenant_email ON tenant_member_invitations (tenant_id, email)
  WHERE accepted_at IS NULL;

CREATE UNIQUE INDEX tenant_member_invitations_token_hash_idx ON tenant_member_invitations (token_hash);

CREATE INDEX tenant_member_invitations_by_expiry ON tenant_member_invitations (expires_at);
