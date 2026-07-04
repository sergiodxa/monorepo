-- Seed the dashboard OAuth client for platform tenant dogfooding.
-- This client is used by the dashboard to authenticate users via the platform tenant.
-- Only runs on the platform tenant (other tenants will have this as a no-op since the client already exists check).

INSERT INTO clients (id, name, description, logo_url, type, allowed_scopes, allowed_resources, is_management_client, created_at, updated_at)
VALUES (
  'dashboard',
  'Auth SaaS Dashboard',
  'Internal OAuth client for dashboard authentication',
  NULL,
  'public',
  '["openid","email","profile"]',
  NULL,
  0,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
)
ON CONFLICT (id) DO UPDATE SET
  allowed_scopes = '["openid","email","profile"]',
  updated_at = strftime('%s', 'now') * 1000;

-- Add localhost redirect URI for development
INSERT INTO client_redirect_uris (id, client_id, uri, environment, created_at)
VALUES (
  'dashboard-redirect-localhost',
  'dashboard',
  'http://localhost:3004/onboarding/callback',
  'development',
  strftime('%s', 'now') * 1000
)
ON CONFLICT (id) DO NOTHING;

-- Add production redirect URI
INSERT INTO client_redirect_uris (id, client_id, uri, environment, created_at)
VALUES (
  'dashboard-redirect-prod',
  'dashboard',
  'https://auth.sergiodxa.com/onboarding/callback',
  'production',
  strftime('%s', 'now') * 1000
)
ON CONFLICT (id) DO NOTHING;

-- NOTE: The tenant issuer is intentionally NOT seeded here. Each tenant's issuer
-- is written once at provisioning time via the internal setup endpoint
-- (POST /api/setup, see src/tenant/controllers/api/setup.ts), derived from the
-- tenant's real hostname. Seeding it in a migration reset every tenant's issuer
-- to a fixed value on every Durable Object cold start.
