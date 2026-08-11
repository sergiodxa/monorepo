-- Scope an alert to a monitor type, and to a monitor of any type
--
-- `alerts.monitor_id` already existed, but nothing recorded which monitor table it pointed
-- into, so it could only ever be resolved as an HTTP monitor: DNS, TCP and cron-job results
-- matched team-wide alerts and nothing else. That was tolerable while a DNS monitor watched
-- one record; a domain monitor reports every newly discovered record, every changed record
-- and every zone edit, and all of it reached every team-wide channel at once.
--
-- `monitor_type` closes that. The pair now says exactly one of three things:
--
--   monitor_type IS NULL, monitor_id IS NULL  -> team-wide: every monitor of every type
--   monitor_type = 'dns',  monitor_id IS NULL  -> every DNS monitor
--   monitor_type = 'dns',  monitor_id = '...'  -> that one DNS monitor
--
-- Added with ALTER TABLE rather than the create/copy/drop/rename rebuild the migrations in
-- this directory use for default changes, because there is nothing here SQLite cannot do in
-- place: a new nullable column with no default and no CHECK. Rebuilding would move live
-- alert rows for no reason, and these rows are what someone's on-call depends on.
ALTER TABLE `alerts` ADD COLUMN `monitor_type` text(16);

-- Every existing row keeps behaving exactly as it did. A row with no monitor is left NULL
-- and stays team-wide; a row with one is backfilled to 'http', which is the only thing its
-- id could ever have meant. Widening these to team-wide instead would start sending a
-- monitor-specific alert everything the team monitors, and leaving them NULL beside a
-- non-null id would encode a scope the application cannot resolve.
UPDATE `alerts` SET `monitor_type` = 'http' WHERE `monitor_id` IS NOT NULL;

-- No new index. `alerts_team_monitor_idx (team_id, monitor_id)` still bounds both halves of
-- the dispatch lookup to one team, and a team holds at most ten alerts, so the monitor_type
-- comparison runs over a handful of rows already in hand. An index on it would cost a
-- written row per alert insert and delete to filter a set that small.
