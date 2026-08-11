-- Scope a maintenance window to a monitor type, and to a monitor of any type
--
-- `maintenance_windows.monitor_id` already existed, but nothing recorded which monitor
-- table it pointed into, so it could only ever be resolved as an HTTP monitor: a DNS, TCP
-- or cron-job check was covered by team-wide windows and nothing else. There was no way to
-- take one domain offline for an hour without silencing every monitor the team owns.
--
-- `monitor_type` closes that, exactly as it did for `alerts` one migration earlier. The
-- pair now says exactly one of three things:
--
--   monitor_type IS NULL, monitor_id IS NULL  -> team-wide: every monitor of every type
--   monitor_type = 'dns',  monitor_id IS NULL  -> every DNS monitor
--   monitor_type = 'dns',  monitor_id = '...'  -> that one DNS monitor
--
-- Added with ALTER TABLE rather than the create/copy/drop/rename rebuild the migrations in
-- this directory use for default changes, because there is nothing here SQLite cannot do in
-- place: a new nullable column with no default and no CHECK. Rebuilding would move live
-- rows for no reason, including windows scheduled for tonight.
ALTER TABLE `maintenance_windows` ADD COLUMN `monitor_type` text(16);

-- Every existing row keeps behaving exactly as it did. A row with no monitor is left NULL
-- and stays team-wide; a row with one is backfilled to 'http', which is the only thing its
-- id could ever have meant. Widening these to team-wide would start silencing every monitor
-- during one monitor's maintenance, and leaving them NULL beside a non-null id would encode
-- a scope the application cannot resolve.
UPDATE `maintenance_windows` SET `monitor_type` = 'http' WHERE `monitor_id` IS NOT NULL;

-- No new index. `maintenance_windows_team_monitor_idx (team_id, monitor_id)` still bounds
-- both halves of the suppression lookup to one team, and a team holds few enough windows
-- that the monitor_type comparison runs over a handful of rows already in hand. An index on
-- it would cost a written row per window insert and delete to filter a set that small.
