-- Per-tenant subscriptions (ADR-018): a subscription attaches to a tenant, never to its
-- owning customer, so `customers` only ever needs the join to the provider's own
-- customer record and every plan, period and lapse fact lives on the tenant it governs.

-- `customers`: renamed to `provider_customer_id`/`provider_connection` so a row states
-- which credential set issued the id it carries, matching `Billing.connection`.
ALTER TABLE customers RENAME COLUMN billing_connection TO provider_connection;
ALTER TABLE customers RENAME COLUMN billing_customer_id TO provider_customer_id;
DROP INDEX customers_billing;
CREATE UNIQUE INDEX customers_billing ON customers (provider_connection, provider_customer_id);

-- `tenants`: rebuilt rather than altered in place, because `plan` drops its
-- `free`/`pro`/`premium` CHECK to become a free-text slug (ADR-019 names the real
-- tiers) and three lapse columns join `subscription_id` (renamed from
-- `billing_subscription_id`) and the columns that already existed.
CREATE TABLE tenants_new (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  issuer TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT 'wnam',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  plan_slug TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  subscription_id TEXT UNIQUE,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  grace_until INTEGER,
  lapsed_at INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

INSERT INTO tenants_new (
  id, customer_id, name, slug, issuer, region, status, plan_slug,
  subscription_status, subscription_id, current_period_end,
  cancel_at_period_end, grace_until, lapsed_at, deleted_at, created_at, updated_at
)
SELECT
  id, customer_id, name, slug, issuer, region, status, plan,
  subscription_status, billing_subscription_id, current_period_end,
  0, NULL, NULL, deleted_at, created_at, updated_at
FROM tenants;

DROP TABLE tenants;
ALTER TABLE tenants_new RENAME TO tenants;
CREATE INDEX tenants_customer ON tenants (customer_id);

-- A tenant may carry more than one add-on subscription over its life, each a
-- separate Polar subscription on top of its base plan.
CREATE TABLE tenant_addons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX tenant_addons_tenant ON tenant_addons (tenant_id);

-- The projection `requireEntitlement()` gates on and `/authorize` reads: one row per
-- tenant, kept off the request path from a billing platform. Keyed on `tenant_id`
-- itself rather than a minted id, since it is a cache of what a tenant currently
-- holds rather than an independent record.
CREATE TABLE tenant_entitlements (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  products TEXT NOT NULL DEFAULT '[]',
  features TEXT NOT NULL DEFAULT '{}',
  read_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

-- Written before a checkout ever leaves the process, so a retried open reuses
-- `attempt_id` as its idempotency key and a completed checkout resolves to a tenant
-- through this row rather than through metadata a delivery may not carry.
CREATE TABLE billing_checkouts (
  attempt_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  product_slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('base','addon')),
  checkout_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX billing_checkouts_checkout ON billing_checkouts (checkout_id) WHERE checkout_id IS NOT NULL;
CREATE INDEX billing_checkouts_tenant ON billing_checkouts (tenant_id);

-- The `WebhookStore` `BillingWebhook` is built with. `id` is the platform's own
-- delivery id, never one this app mints, since deduplication keys on the delivery
-- rather than the object it names.
CREATE TABLE billing_deliveries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  valid INTEGER NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  received_at INTEGER NOT NULL
);
