-- Vendor-neutral billing identifiers. An account's customer link becomes a row per
-- billing connection, since one account legitimately holds a separate identity on
-- each configured connection; the subscription keeps the platform's own id and our
-- product slug; and every webhook delivery is recorded before it is trusted.

CREATE TABLE billing_customers (
	subject_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
	connection TEXT NOT NULL,
	provider_customer_id TEXT NOT NULL,
	is_default INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (subject_id, connection)
);
CREATE UNIQUE INDEX idx_billing_customers_provider
	ON billing_customers (connection, provider_customer_id);
CREATE UNIQUE INDEX idx_billing_customers_default
	ON billing_customers (subject_id) WHERE is_default = 1;

INSERT INTO billing_customers
	(subject_id, connection, provider_customer_id, is_default, created_at, updated_at)
SELECT id, 'polar', polar_customer_id, 1, created_at, updated_at
FROM accounts
WHERE polar_customer_id IS NOT NULL;

-- `polar_customer_id` carries a UNIQUE index, which SQLite refuses to drop a column
-- through, so the table is rebuilt around the columns that stay.
PRAGMA foreign_keys=OFF;

CREATE TABLE accounts_rebuilt (
	id TEXT PRIMARY KEY,
	oidc_subject TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL,
	display_name TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
INSERT INTO accounts_rebuilt (id, oidc_subject, email, display_name, created_at, updated_at)
SELECT id, oidc_subject, email, display_name, created_at, updated_at FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_rebuilt RENAME TO accounts;
CREATE INDEX idx_accounts_subject ON accounts (oidc_subject);

PRAGMA foreign_keys=ON;

ALTER TABLE subscriptions RENAME COLUMN polar_subscription_id TO billing_subscription_id;
ALTER TABLE subscriptions RENAME COLUMN polar_product_id TO billing_product_slug;

CREATE TABLE webhook_deliveries (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	payload TEXT NOT NULL,
	valid INTEGER NOT NULL DEFAULT 0,
	processed INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_webhook_deliveries_processed ON webhook_deliveries (processed);
