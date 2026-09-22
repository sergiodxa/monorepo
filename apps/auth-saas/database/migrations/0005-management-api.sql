-- The management API's own plumbing: one signing identity for the whole platform,
-- and the registered clients a tenant issues programmatic access through.

-- One row per key in the platform's own rotation, the same staged/signing/retired
-- shape a tenant's own `signing_keys` carries, with no `tenant_id` — this identity
-- is shared by every tenant's administrative surface rather than issued per tenant.
CREATE TABLE platform_signing_keys (
  id TEXT PRIMARY KEY,
  alg TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  signing_from INTEGER,
  retired_at INTEGER,
  publish_until INTEGER
);

-- A tenant's own programmatic credential: presented at the management API's token
-- endpoint for a short-lived access token bound to this tenant and ceilinged at
-- these scopes.
CREATE TABLE management_clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name TEXT NOT NULL, hint TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
);
CREATE INDEX management_clients_tenant ON management_clients (tenant_id);
