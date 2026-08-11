-- Flow monitors: several requests and the assertions that make them a flow (ADR-027)
--
-- A new monitor type, so there is nothing to migrate and nothing to back-fill. `IF NOT
-- EXISTS` keeps this re-runnable.
--
-- There is deliberately no column for which hosts a monitor may reach. The `net` grant each
-- run gets is computed from the team's verified domains every time, so a flow can only drive a
-- domain the team has proved it owns, and removing a domain stops its flows at the next check.
-- A stored allowance would be a copy of team state that goes stale in the one direction that
-- matters.
--
-- Index review, by hand, per `AGENTS.md` and ADR-010:
--
--   * No `flow_monitors_id_unique` or `flow_monitor_results_id_unique`. `id` is a
--     single-column PRIMARY KEY, so SQLite already maintains an autoindex for it and an
--     explicit unique index would only cost a written row per insert and per delete. This is
--     the mistake `20260730100000_drop_duplicate_id_indexes.sql` removed everywhere else;
--     a new table is where it creeps back in.
--   * `flow_monitors_next_due_at_idx` serves the sweep, which is the only query that reads
--     across teams: `next_due_at IS NOT NULL AND next_due_at <= ?` (ADR-006). NULL is
--     "not scheduled", so this one index subsumes an `is_enabled` check and there is
--     deliberately no index on `is_enabled` alone.
--   * `flow_monitors_team_idx` serves every list and every digest read, all of which filter
--     `team_id` first.
--   * `flow_monitor_results_monitor_checked_idx` is composite and leads on the monitor,
--     which is how the detail page reads a monitor's history newest-first. SQLite seeks a
--     composite index by prefix, so this also serves a plain `flow_monitor_id` lookup and
--     no separate index is needed for one.
--   * `flow_monitor_results_checked_at_idx` serves the nightly retention sweep's
--     `WHERE checked_at < ?` (ADR-020), which the composite above cannot: `checked_at` is
--     its second column, and a range on a non-leading column is not seekable.

CREATE TABLE IF NOT EXISTS flow_monitors (
	id TEXT PRIMARY KEY,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	team_id TEXT NOT NULL,
	name TEXT NOT NULL,
	source TEXT NOT NULL,
	interval_seconds INTEGER NOT NULL DEFAULT 3600,
	next_due_at INTEGER,
	is_enabled INTEGER NOT NULL DEFAULT 1,
	last_checked_at INTEGER,
	last_status TEXT
);

CREATE INDEX IF NOT EXISTS flow_monitors_next_due_at_idx ON flow_monitors (next_due_at);
CREATE INDEX IF NOT EXISTS flow_monitors_team_idx ON flow_monitors (team_id);

CREATE TABLE IF NOT EXISTS flow_monitor_results (
	id TEXT PRIMARY KEY,
	flow_monitor_id TEXT NOT NULL,
	status TEXT NOT NULL,
	tests_total INTEGER NOT NULL DEFAULT 0,
	tests_passed INTEGER NOT NULL DEFAULT 0,
	tests_failed INTEGER NOT NULL DEFAULT 0,
	requests_made INTEGER NOT NULL DEFAULT 0,
	failed_test TEXT,
	failed_at_line INTEGER,
	failure_detail TEXT,
	duration_ms INTEGER,
	error_message TEXT,
	checked_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS flow_monitor_results_monitor_checked_idx
	ON flow_monitor_results (flow_monitor_id, checked_at);
CREATE INDEX IF NOT EXISTS flow_monitor_results_checked_at_idx
	ON flow_monitor_results (checked_at);
