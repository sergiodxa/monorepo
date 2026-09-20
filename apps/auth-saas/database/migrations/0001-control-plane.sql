-- Control-plane schema (ADR-003): which tenants exist, who administers each, which
-- hostname reaches which tenant, and what each is billed. A tenant's own subjects,
-- clients and keys live in that tenant's Durable Object, never in this database.

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_connection TEXT NOT NULL DEFAULT 'polar',
  billing_customer_id TEXT,
  internal INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX customers_billing ON customers (billing_connection, billing_customer_id);

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  issuer TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT 'wnam',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
  subscription_status TEXT NOT NULL DEFAULT 'active',
  billing_subscription_id TEXT UNIQUE,
  current_period_end INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX tenants_customer ON tenants (customer_id);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX memberships_tenant_subject ON memberships (tenant_id, subject_id);
CREATE INDEX memberships_subject ON memberships (subject_id);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('platform','custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','failed')),
  certificate_status TEXT,
  verification_name TEXT, verification_value TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX domains_platform ON domains (tenant_id) WHERE kind = 'platform';
CREATE INDEX domains_tenant ON domains (tenant_id);
CREATE INDEX domains_pending ON domains (id) WHERE status = 'pending';
