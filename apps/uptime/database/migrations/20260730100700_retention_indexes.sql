-- Migration: Index the columns the retention sweeps filter on (ADR-020)
--
-- Retention now covers every table that grows with monitor activity, and each of those
-- sweeps is a `WHERE <date column> < ?` range. A range needs an index whose leading column
-- is that date column, or the sweep degrades into a full table scan of exactly the table
-- it exists to keep small. The inventory below was read from `sqlite_master` rather than
-- taken on trust, and only the two genuinely missing indexes are created here:
--
--   dns_monitor_results  checked_at    dns_monitor_results_checked_at_idx  already exists
--   tcp_monitor_results  checked_at    tcp_monitor_results_checked_at_idx  already exists
--   alert_events         sent_at       alert_events_sent_at_idx            already exists
--   cron_job_pings       created_at    cron_job_pings_created_at_idx       already exists
--   monitor_results      completed_at  --                                  created below
--
-- `monitor_results` does have a composite that mentions `completed_at`
-- (`monitor_id`, `completed_at`, `response_status`, `response_time_ms`), but its leading
-- column is `monitor_id`, so a predicate on `completed_at` alone cannot seek into it. The
-- retention delete has therefore been a full scan since it was written — cheap while the
-- table holds a week of rows, and the one index the sweeps were missing.
CREATE INDEX `monitor_results_completed_at_idx` ON `monitor_results` (`completed_at`);

-- The `cron_job_pings` sweep has a second pass that nulls `source_ip` and `user_agent`
-- once a ping is older than 30 days, while the row itself is kept for a year. Left to
-- `cron_job_pings_created_at_idx`, that pass would re-scan eleven months of already-redacted
-- rows every night just to find the day of new ones. This partial index only contains rows
-- that still hold details, so a redacted row leaves the index and the nightly pass reads
-- roughly the rows it is about to redact, not the whole retention window. It costs one
-- written row per ping inserted and one per ping redacted.
CREATE INDEX `cron_job_pings_unredacted_idx` ON `cron_job_pings` (`created_at`)
WHERE `source_ip` IS NOT NULL OR `user_agent` IS NOT NULL;
