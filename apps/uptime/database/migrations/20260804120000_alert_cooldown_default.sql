-- Migration: An ongoing outage alerts once an hour (revises ADR-004)
--
-- The alert repeat policy is now: notify immediately when a monitor is detected down, stay
-- quiet while it is still down until an hour has passed and then notify again — for as long
-- as the outage lasts — plus one notification when it recovers. `alerts.cooldown_minutes`
-- is what spaces the repeats, so its default becomes 60: an hourly monitor always alerts.
--
-- SQLite cannot alter a column default in place, so the table is rebuilt — the same
-- create/copy/drop/rename shape earlier migrations in this directory use. The column list is
-- the table as the migrations leave it (`id`, `created_at`, `updated_at`, `team_id`,
-- `monitor_id`, `config`, `name`, `notify_on_recovery`, `cooldown_minutes`), and
-- `alerts_team_monitor_idx` is recreated afterwards because dropping the table drops its
-- indexes with it. No table has a foreign key referencing `alerts`, so no PRAGMA dance is
-- needed here.
--
-- Existing rows are deliberately NOT rewritten. A team that went and chose a cooldown chose
-- it, and the new default is a default, not a policy imposed on configured alerts — the same
-- reasoning that left rows alone when the default moved from 0 to 15. Rows storing `0` are
-- included in that: `0` stays a legal stored value and is instead floored at dispatch time
-- (`MIN_REPEAT_COOLDOWN_MINUTES` in `app/services/alerts.ts`), which bounds them without
-- editing anyone's configuration and without depending on a form validator that stored rows
-- never pass through.
--
-- The per-incident send ceiling that used to bound those rows is gone, because it silenced
-- an hourly monitor after ten hours of downtime, which the policy above forbids. Nothing
-- writes `alert_events.status = 'skipped_cap'` any more; the value stays in the enum for the
-- rows already carrying it, and needs no DDL either way (the column is plain `TEXT NOT NULL`
-- with no CHECK constraint).
CREATE TABLE `__new_alerts` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`monitor_id` text(36),
	`config` text NOT NULL,
	`name` text NOT NULL,
	`notify_on_recovery` integer DEFAULT 1 NOT NULL,
	`cooldown_minutes` integer DEFAULT 60 NOT NULL
);

INSERT INTO `__new_alerts` (
	"id",
	"created_at",
	"updated_at",
	"team_id",
	"monitor_id",
	"config",
	"name",
	"notify_on_recovery",
	"cooldown_minutes"
)
SELECT
	"id",
	"created_at",
	"updated_at",
	"team_id",
	"monitor_id",
	"config",
	"name",
	"notify_on_recovery",
	"cooldown_minutes"
FROM `alerts`;

DROP TABLE `alerts`;

ALTER TABLE `__new_alerts` RENAME TO `alerts`;

CREATE INDEX `alerts_team_monitor_idx` ON `alerts` (`team_id`, `monitor_id`);
