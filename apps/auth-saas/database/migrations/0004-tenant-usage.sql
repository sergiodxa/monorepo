-- Metered daily usage per tenant (see database/metering.ts and
-- app/services/tenant-usage.ts): one row per tenant per closed day, the figure
-- the cost ledger and usage reporting both read.
CREATE TABLE tenant_usage_day (
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  day INTEGER NOT NULL,
  subjects INTEGER NOT NULL,
  sessions INTEGER NOT NULL,
  tokens INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, day)
);
