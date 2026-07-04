-- Teams feature: tenant members and invites
-- Allows sharing tenant access with other users

-- ============================================================================
-- TENANT MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_subject ON tenant_members(subject_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_subject_tenant ON tenant_members(subject_id, tenant_id);

-- ============================================================================
-- TENANT INVITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_invites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_subject_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant ON tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites(email);

-- ============================================================================
-- PLATFORM TENANT SEED
-- ============================================================================

-- Create the platform tenant record
-- The owner_subject_id uses a pending format until first login resolves it
INSERT INTO tenants (id, name, slug, owner_subject_id, region, status, created_at, updated_at)
VALUES (
  'platform',
  'Auth SaaS Platform',
  'platform',
  'pending:hello@sergiodxa.com',
  'wnam',
  'active',
  datetime('now'),
  datetime('now')
)
ON CONFLICT (id) DO NOTHING;

-- Create default hostname for platform tenant
INSERT INTO hostnames (id, tenant_id, hostname, is_default, status, created_at, updated_at)
VALUES (
  'platform-hostname',
  'platform',
  'auth.sergiodxa.com',
  1,
  'active',
  datetime('now'),
  datetime('now')
)
ON CONFLICT (hostname) DO NOTHING;
