-- Outbound webhook endpoints (see webhook-endpoints.ts): a tenant's own registered
-- receiver for its directory's events, subscribed to event types drawn from the
-- audit catalog. The disable columns and the failure counter exist from the start
-- so a later pass that drives deliveries against this table never needs a schema
-- change of its own to record what it observes.
CREATE TABLE webhook_endpoints (
	id TEXT PRIMARY KEY,
	url TEXT NOT NULL,
	description TEXT NOT NULL,
	event_types TEXT NOT NULL,
	sealed_secret TEXT NOT NULL,
	sealed_previous TEXT,
	previous_expires_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	disabled_at INTEGER,
	disabled_reason TEXT,
	consecutive_failures INTEGER NOT NULL DEFAULT 0
);
