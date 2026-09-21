-- Outbound webhook deliveries (see webhook-deliveries.ts): one row per endpoint a
-- succeeded audit event matched, carrying the exact signed body through its own
-- retry lifecycle from a first pending attempt to a delivered or exhausted end.
CREATE TABLE webhook_deliveries (
	id TEXT PRIMARY KEY,
	endpoint_id TEXT NOT NULL,
	event_type TEXT NOT NULL,
	sequence INTEGER NOT NULL,
	payload TEXT NOT NULL,
	status TEXT NOT NULL,
	attempts INTEGER NOT NULL DEFAULT 0,
	next_attempt_at INTEGER,
	last_status INTEGER,
	last_error TEXT,
	last_attempt_at INTEGER,
	delivered_at INTEGER,
	created_at INTEGER NOT NULL,
	replay_of TEXT
);
CREATE INDEX webhook_deliveries_due ON webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX webhook_deliveries_by_endpoint ON webhook_deliveries (endpoint_id, created_at DESC, id);
