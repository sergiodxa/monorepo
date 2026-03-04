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
  'openid email profile',
  NULL,
  0,
  datetime('now'),
  datetime('now')
)
ON CONFLICT (id) DO NOTHING;

-- Add localhost redirect URI for development
INSERT INTO redirect_uris (id, client_id, uri, environment, created_at)
VALUES (
  'dashboard-redirect-localhost',
  'dashboard',
  'http://localhost:3004/onboarding/callback',
  'development',
  datetime('now')
)
ON CONFLICT (id) DO NOTHING;

-- Add production redirect URI
INSERT INTO redirect_uris (id, client_id, uri, environment, created_at)
VALUES (
  'dashboard-redirect-prod',
  'dashboard',
  'https://auth.sergiodxa.com/onboarding/callback',
  'production',
  datetime('now')
)
ON CONFLICT (id) DO NOTHING;
