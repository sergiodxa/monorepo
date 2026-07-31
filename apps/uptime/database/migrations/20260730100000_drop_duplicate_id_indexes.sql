-- Migration: Drop the redundant duplicate `id` indexes (ADR-010)
--
-- Every table below declares `id` as a single-column `PRIMARY KEY`, so SQLite already
-- maintains an automatic unique index for it (`sqlite_autoindex_<table>_1`). The
-- `<table>_id_unique` index is a second unique index over the exact same column, with the
-- same uniqueness and the same collation, so nothing can use it that the primary-key
-- autoindex cannot. It exists only because the migration generator emitted an explicit
-- unique index for a column that was already declared `PRIMARY KEY`.
--
-- The duplicate is not free: an index adds one written row per insert and per delete that
-- touches the indexed column, so each duplicate costs +1 row written on every insert and
-- every retention delete. Dropping them lowers write cost and storage on the hot paths
-- (`monitor_results`, `cron_job_pings`, `dns_monitor_results`, `tcp_monitor_results`,
-- `cron_job_monitors`) and loses no data and no query plan: `WHERE id = ?` lookups keep
-- resolving through the primary-key autoindex.
--
-- Each index below was verified against `sqlite_master` / `pragma_index_list` before being
-- listed here: the table's primary key is the single `id` column (never composite), and the
-- `pk`-origin autoindex on `id` exists. `monitor_daily_stats` is deliberately absent — the
-- generator never emitted a duplicate for it, so it has nothing to drop. `IF EXISTS` keeps
-- the migration re-runnable if a database is missing one of them.
--
-- ADR-010's second half landed in `20260731100800_drop_find_due_indexes.sql`, once ADR-003
-- had moved scheduling off this table: it drops `monitor_results_created_at_idx` and keeps
-- the four-column composite, which turned out to serve four live queries rather than only
-- `Monitor.findDue`.

DROP INDEX IF EXISTS `alerts_id_unique`;
DROP INDEX IF EXISTS `cron_job_monitors_id_unique`;
DROP INDEX IF EXISTS `cron_job_pings_id_unique`;
DROP INDEX IF EXISTS `dns_monitor_results_id_unique`;
DROP INDEX IF EXISTS `dns_monitors_id_unique`;
DROP INDEX IF EXISTS `invites_id_unique`;
DROP INDEX IF EXISTS `maintenance_windows_id_unique`;
DROP INDEX IF EXISTS `memberships_id_unique`;
DROP INDEX IF EXISTS `monitor_content_checks_id_unique`;
DROP INDEX IF EXISTS `monitor_results_id_unique`;
DROP INDEX IF EXISTS `monitors_id_unique`;
DROP INDEX IF EXISTS `tcp_monitor_results_id_unique`;
DROP INDEX IF EXISTS `tcp_monitors_id_unique`;
DROP INDEX IF EXISTS `team_domains_id_unique`;
DROP INDEX IF EXISTS `teams_id_unique`;
