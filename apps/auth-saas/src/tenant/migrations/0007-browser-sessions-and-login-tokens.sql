-- Browser sessions (silent SSO) and magic-link login tokens.
--
-- Timestamp columns are TEXT holding ISO-8601 strings, matching how the models
-- read/write them (see sessions/subjects models) and enabling lexicographic
-- expiry comparisons.

-- ============================================================================
-- BROWSER SESSIONS
-- A single IdP-side session per browser, shared across the OAuth clients the
-- user signs into. Enables silent re-authorization at /authorize and grouped
-- logout across clients.
-- ============================================================================
CREATE TABLE IF NOT EXISTS browser_sessions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_subject ON browser_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_expires ON browser_sessions(expires_at);

-- Link each per-client session back to the browser session that created it, so
-- logout can fan out across every client in the same browser session.
ALTER TABLE sessions ADD COLUMN browser_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_browser ON sessions(browser_session_id);

-- ============================================================================
-- LOGIN TOKENS (magic link)
-- Single-use, short-lived tokens that carry the captured /authorize context so
-- a click-through can resume the authorization-code flow. Stored hashed.
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  client_id TEXT,
  redirect_uri TEXT,
  scope TEXT,
  state TEXT,
  nonce TEXT,
  pkce_challenge TEXT,
  pkce_method TEXT,
  consumed_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_tokens_expires ON login_tokens(expires_at);
