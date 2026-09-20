-- What this tenant object enforces about its own plan (ADR-018): one row, kept
-- current by `applyEntitlements` on every projection write.
CREATE TABLE entitlement_enforcement (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  features TEXT NOT NULL DEFAULT '{}',
  dau_cap INTEGER,
  audit_retention_days INTEGER,
  effective_at INTEGER NOT NULL
);
