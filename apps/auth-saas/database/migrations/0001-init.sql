-- Platform D1 Database Schema
-- This stores control plane data for managing tenants

-- ============================================================================
-- TENANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_subject_id TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'wnam',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_subject_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ============================================================================
-- HOSTNAMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS hostnames (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  is_default INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_validation',
  ssl_status TEXT,
  validation_txt_name TEXT,
  validation_txt_value TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hostnames_tenant ON hostnames(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostnames_status ON hostnames(status);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  polar_customer_id TEXT,
  polar_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================================
-- MAU TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS mau_tracking (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  month TEXT NOT NULL,
  first_auth_at TEXT NOT NULL,
  UNIQUE(tenant_id, subject_id, month)
);

CREATE INDEX IF NOT EXISTS idx_mau_tenant_month ON mau_tracking(tenant_id, month);
