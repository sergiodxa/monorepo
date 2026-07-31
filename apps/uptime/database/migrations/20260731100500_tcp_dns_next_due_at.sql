-- Honour `interval_seconds` for TCP and DNS monitors (ADR-006)
-- Both tables already carried an editable, billed `interval_seconds` that nothing read:
-- the sweeps checked every enabled monitor on their own fixed cadence, so a monitor's
-- configured interval and the work performed for it disagreed in both directions. Giving
-- both tables the same `next_due_at` column `monitors` has turns each sweep into a claim of
-- the monitors that are actually due, which is what makes the column authoritative.
ALTER TABLE `tcp_monitors` ADD COLUMN `next_due_at` integer;
ALTER TABLE `dns_monitors` ADD COLUMN `next_due_at` integer;

-- `next_due_at IS NULL` means "not scheduled", so this one index per table serves the whole
-- claim predicate and no index on `is_enabled` is needed.
CREATE INDEX `tcp_monitors_next_due_at_idx` ON `tcp_monitors` (`next_due_at`);
CREATE INDEX `dns_monitors_next_due_at_idx` ON `dns_monitors` (`next_due_at`);

-- Backfill, and the reason this migration is not safe without it: the `ALTER TABLE`s above
-- leave every existing row at NULL, which the claim reads as "not scheduled" — so every
-- already-enabled TCP and DNS monitor would silently stop being checked the moment this
-- lands. Anchoring them to this migration's own timestamp (already in the past whenever it
-- is applied) makes each one due once on the next tick, after which the claim advances it by
-- whole intervals. Disabled monitors are left NULL, which is exactly what "not scheduled"
-- means for them.
UPDATE `tcp_monitors` SET `next_due_at` = 1785492300000 WHERE `is_enabled` = 1;
UPDATE `dns_monitors` SET `next_due_at` = 1785492300000 WHERE `is_enabled` = 1;
