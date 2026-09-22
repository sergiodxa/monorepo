-- Per-tenant session policy (see session-policy.ts): five knobs on `settings`,
-- each null meaning "not customized, use the platform default" -- the same
-- nullable-means-unbounded convention `entitlement_enforcement` already uses
-- for its own dau_cap and audit_retention_days, the same way `settings`
-- already carries a per-tenant MFA policy and failure threshold.
ALTER TABLE settings ADD COLUMN session_absolute_lifetime_ms INTEGER;
ALTER TABLE settings ADD COLUMN session_idle_lifetime_ms INTEGER;
ALTER TABLE settings ADD COLUMN refresh_token_lifetime_ms INTEGER;
ALTER TABLE settings ADD COLUMN concurrent_session_limit INTEGER;
ALTER TABLE settings ADD COLUMN sessions_after_credential_change TEXT;
