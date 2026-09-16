-- The billing projection: this app's authoritative record of what the payment platform
-- last said, applied to the D1 database bound as PLATFORM_DB.
--
-- It is the one layer rebuildable from nothing. Replaying the platform's entitlement read
-- over billing_customers reconstructs both these rows and the tier column in every
-- reader's object downstream, so losing this database costs a sweep.
--
-- Nothing that renders a page reads it. The tier a request enforces against is already in
-- the object the request is talking to.
--
-- Timestamps are INTEGER epoch milliseconds, the way every other table in this app spells
-- them, so a value binds, sorts and compares the same wherever it is read.

-- One row per reader per connection, written the first time they reach a checkout. A
-- reader who never opened one has no row, which is what keeps the daily sweep bounded by
-- how many readers have ever paid rather than by how many readers exist.
CREATE TABLE billing_customers (
	-- The reader's OIDC subject, which also names their Durable Object.
	subject TEXT NOT NULL,
	-- The credential set that issued the id beside it, so a reader billed through a second
	-- organization later stays distinguishable from these.
	connection TEXT NOT NULL,
	provider_customer_id TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (subject, connection)
);

-- How a delivery naming only the platform's own id reaches a reader, for a customer some
-- support action created without an external id on it.
CREATE UNIQUE INDEX billing_customers_provider_idx
	ON billing_customers (connection, provider_customer_id);

-- The ordering the daily sweep pages in, made total by the subject so a cursor resumes at
-- exactly one row when two readers checked out in the same millisecond.
CREATE INDEX billing_customers_sweep_idx ON billing_customers (created_at, subject);

-- One row per reader, holding the last snapshot the platform answered with.
CREATE TABLE subscriptions (
	subject TEXT PRIMARY KEY,
	billing_connection TEXT NOT NULL,
	billing_subscription_id TEXT,
	status TEXT NOT NULL,
	-- Our own name for what was bought, which is what the tier is derived from.
	product_slug TEXT,
	current_period_end INTEGER,
	-- Kept from the last snapshot that saw the subscription, because it is what tells a
	-- lapse apart from a cancellation the reader asked for after the subscription is gone.
	cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
	-- When the platform answered. A write carrying an older read is refused, so two
	-- snapshots landing out of order converge on the later one.
	checked_at INTEGER NOT NULL,
	provider_data TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- Every delivery the endpoint has received, keyed on the platform's own delivery id. The
-- row is written before the delivery is trusted and marked processed only once a handler
-- ran to completion, so a redelivery of a half-finished delivery is dispatched again while
-- a redelivery of a finished one is skipped.
--
-- It keeps the exact bytes the signature covered, which is what makes a handler that got
-- something wrong auditable afterwards.
CREATE TABLE billing_webhook_deliveries (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	payload TEXT NOT NULL,
	valid INTEGER NOT NULL DEFAULT 0,
	processed INTEGER NOT NULL DEFAULT 0,
	received_at INTEGER NOT NULL
);
