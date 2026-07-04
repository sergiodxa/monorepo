-- CONFIGURATION (no dependencies)
CREATE TABLE IF NOT EXISTS signing_keys (
  id TEXT PRIMARY KEY,
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'ES256',
  is_current INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS branding (
  id TEXT PRIMARY KEY DEFAULT 'default',
  logo_url TEXT,
  primary_color TEXT,
  background_color TEXT,
  custom_css TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  scopes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- OAUTH CLIENTS (no dependencies, referenced by sessions)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  type TEXT NOT NULL,
  allowed_scopes TEXT,
  allowed_resources TEXT,
  is_management_client INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS client_secrets (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL,
  name TEXT,
  last_used_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_secrets_client ON client_secrets(client_id);

CREATE TABLE IF NOT EXISTS client_redirect_uris (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  environment TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(client_id, uri)
);
CREATE INDEX IF NOT EXISTS idx_client_redirect_uris_client ON client_redirect_uris(client_id);

CREATE TABLE IF NOT EXISTS client_logout_uris (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  type TEXT NOT NULL,
  session_required INTEGER DEFAULT 0,
  environment TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(client_id, uri, type)
);
CREATE INDEX IF NOT EXISTS idx_client_logout_uris_client ON client_logout_uris(client_id);

-- RESOURCES (no dependencies)
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  scopes TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- SUBJECTS & AUTHENTICATION (no dependencies, referenced by many tables)
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified_at INTEGER,
  display_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subjects_email ON subjects(email);
CREATE INDEX IF NOT EXISTS idx_subjects_created_unverified ON subjects(created_at) WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up INTEGER DEFAULT 0,
  transports TEXT,
  name TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_passkeys_subject ON passkeys(subject_id);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_connections_subject ON connections(subject_id);

-- SESSIONS (depends on subjects and clients)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- GRANTS (depends on subjects and clients)
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scopes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(subject_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_grants_subject ON grants(subject_id);
CREATE INDEX IF NOT EXISTS idx_grants_client ON grants(client_id);

-- SHORT-LIVED TOKENS
CREATE TABLE IF NOT EXISTS authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT,
  nonce TEXT,
  pkce_challenge TEXT,
  pkce_method TEXT,
  auth_time INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_authz_codes_expires ON authorization_codes(expires_at);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL,
  subject_id TEXT,
  email TEXT,
  client_id TEXT,
  redirect_uri TEXT,
  state TEXT,
  nonce TEXT,
  scope TEXT,
  pkce_challenge TEXT,
  pkce_method TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webauthn_expires ON webauthn_challenges(expires_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_expires ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_tokens_token ON email_verification_tokens(token);
