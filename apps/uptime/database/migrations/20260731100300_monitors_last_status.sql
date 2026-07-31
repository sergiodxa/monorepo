-- Carry the last HTTP check's status on the monitor row
-- Recovery detection used to learn the previous status by querying Analytics Engine over
-- HTTP once per check, and the monitors list did the same once per monitor per page view
-- (an N+1). Both readers already hold the `monitors` row, so the answer belongs on it —
-- which is what DNS, TCP and cron monitors already do. These columns are a cache; the
-- `uptime_monitor_results` stream stays authoritative for history and aggregation.
ALTER TABLE `monitors` ADD COLUMN `last_status` text;
ALTER TABLE `monitors` ADD COLUMN `last_checked_at` integer;
ALTER TABLE `monitors` ADD COLUMN `last_response_time_ms` integer;

-- No backfill: NULL means "never checked", which is already how recovery detection treats
-- a missing previous status (never a recovery) and how the list badge renders one
-- (`Unknown`). Every existing monitor fills these in on its next check.
--
-- No index either. Nothing filters or sorts on these columns, and an index here would only
-- add a written row per check — the cost this change exists to avoid.
