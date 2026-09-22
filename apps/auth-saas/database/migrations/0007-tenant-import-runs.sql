-- A tenant's own bulk-import run against its directory: one row per run, holding
-- the source file it reads from, the report it writes failures to, and the
-- counters a management API caller or the dashboard polls while a job walks the
-- file in batches (see app/models/tenant-import-run.ts).
--
-- `cursor` tracks how many rows of the source file the run has already
-- consumed. A job paces itself across many separate invocations rather than one
-- long-running call, so each tick needs to know exactly where the previous tick
-- left off; this is the one place that position is durable between ticks.
CREATE TABLE tenant_import_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  mode TEXT NOT NULL,                -- "validate" | "apply"
  source_key TEXT NOT NULL, report_key TEXT,
  status TEXT NOT NULL,              -- "queued" | "running" | "completed" | "failed"
  total INTEGER, processed INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  cursor INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER, finished_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX tenant_import_runs_tenant ON tenant_import_runs (tenant_id);
