-- Schedule HTTP checks from a `next_due_at` column on the monitor row
-- The scheduler used to decide which monitors were due by recomputing every monitor's
-- last completion from the whole result table (`MAX(completed_at) … GROUP BY
-- monitor_id`), which SQLite can only answer by reading every row of it, once per
-- every-minute cron delivery. Storing the next due time on the monitor row turns that
-- into an indexed range seek over a handful of rows, and makes the configured interval
-- authoritative instead of sliding forward by each check's own latency.
ALTER TABLE `monitors` ADD COLUMN `next_due_at` integer;

-- `next_due_at IS NULL` means "not scheduled" (disabled, or never enabled), so this one
-- index serves the whole scheduling predicate and no index on `enabled_at` is needed.
CREATE INDEX `monitors_next_due_at_idx` ON `monitors` (`next_due_at`);

-- Backfill, and the reason this migration is not safe without it: the `ALTER TABLE`
-- above leaves every existing row at NULL, which the scheduler reads as "not
-- scheduled" — so every already-enabled monitor would silently stop being checked the
-- moment this lands. Anchoring them to this migration's own timestamp (already in the
-- past whenever it is applied) makes each one due once on the next tick, after which
-- the scheduler advances it by whole intervals. Disabled monitors are left NULL, which
-- is exactly what "not scheduled" means for them.
UPDATE `monitors` SET `next_due_at` = 1785405720000 WHERE `enabled_at` IS NOT NULL;
