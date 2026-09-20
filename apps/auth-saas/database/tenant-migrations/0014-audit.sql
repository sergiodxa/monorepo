-- The tenant's own append-only audit log (see audit-events.ts): who did what, to
-- what, and how it turned out. `id` sorts the same way `at` does, since
-- `writeAuditEvent` mints it as an ever-growing sequence, so the two secondary
-- indexes below are the only ones this table needs beyond its own primary key.
CREATE TABLE audit_events (
	id TEXT PRIMARY KEY,
	at INTEGER NOT NULL,
	action TEXT NOT NULL,
	actor_type TEXT NOT NULL,
	actor_id TEXT NOT NULL,
	target_type TEXT NOT NULL,
	target_id TEXT NOT NULL,
	outcome TEXT NOT NULL,
	context TEXT NOT NULL,
	detail TEXT NOT NULL
);

CREATE INDEX audit_events_by_action ON audit_events (action, at, id);

CREATE INDEX audit_events_by_target ON audit_events (target_id, at, id);
