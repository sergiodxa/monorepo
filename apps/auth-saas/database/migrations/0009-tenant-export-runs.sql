-- A tenant's own bulk-export run against its directory: one row per run, holding
-- whether it carries password hashes, the R2 object its NDJSON output lands at,
-- and the counters a management API caller or the dashboard polls while a job
-- walks the directory page by page (see app/models/tenant-export-run.ts).
--
-- `cursor` holds the opaque keyset cursor `exportSubjectPage` hands back rather
-- than a row position, and is what lets a job resume a tick exactly where an
-- earlier one left off — the same durability need `tenant_import_runs.cursor`
-- answers for a source file's row position, carried here as TEXT since a
-- keyset cursor is an opaque string rather than a count.
--
-- Export never writes to the tenant's own object, so it never risks crossing
-- that object's storage ceiling the way an import does; `total`, when a caller
-- supplies one, is only a subject-count estimate a progress display divides
-- `processed` by, and gates nothing here.
CREATE TABLE tenant_export_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  include_credentials INTEGER NOT NULL,
  status TEXT NOT NULL,              -- "queued" | "running" | "completed" | "failed"
  cursor TEXT, report_key TEXT,
  total INTEGER, processed INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER, finished_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX tenant_export_runs_tenant ON tenant_export_runs (tenant_id);
