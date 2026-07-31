-- Index the alert and maintenance-window team scopes
-- Both lookups on the alerting hot path filter on `team_id` plus a `monitor_id` that is
-- either a specific monitor or NULL (team-wide). `alerts` had no usable secondary index
-- at all, so every non-healthy check result scanned every alert row of every tenant. A
-- composite on (team_id, monitor_id) turns each half of that lookup into an index seek
-- bounded by the team, and also serves the team-wide-only lookup on its own.
CREATE INDEX `alerts_team_monitor_idx` ON `alerts` (`team_id`, `monitor_id`);

-- `maintenance_windows` already had single-column indexes on `team_id` and `monitor_id`.
-- The composite lets the monitor-scoped seek stay inside one team instead of seeking
-- `monitor_id` platform-wide and filtering `team_id` afterwards.
CREATE INDEX `maintenance_windows_team_monitor_idx` ON `maintenance_windows` (`team_id`, `monitor_id`);
