-- Stored billing ids say which platform issued them, and a tenant's customer link
-- becomes a row per connection so several provider identities can coexist while one
-- of them is the connection the tenant is billed against right now.

-- ============================================================================
-- BILLING CUSTOMERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_customers (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection TEXT NOT NULL,
  provider_customer_id TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, connection)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_customers_default
  ON billing_customers(tenant_id) WHERE is_default = 1;

INSERT INTO billing_customers (tenant_id, connection, provider_customer_id, is_default, created_at, updated_at)
SELECT tenant_id, 'polar', polar_customer_id, 1, created_at, updated_at
FROM subscriptions
WHERE polar_customer_id IS NOT NULL;

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

ALTER TABLE subscriptions RENAME COLUMN polar_subscription_id TO billing_subscription_id;
ALTER TABLE subscriptions ADD COLUMN billing_connection TEXT NOT NULL DEFAULT 'polar';
ALTER TABLE subscriptions ADD COLUMN provider_data TEXT;
ALTER TABLE subscriptions DROP COLUMN polar_customer_id;

-- ============================================================================
-- WEBHOOK DELIVERIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_webhook_deliveries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  valid INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_deliveries_received
  ON billing_webhook_deliveries(received_at);
