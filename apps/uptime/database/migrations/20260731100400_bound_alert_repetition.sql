-- Migration: Bound alert repetition (ADR-004)
--
-- `alerts.cooldown_minutes` defaulted to 0, so an alert created through the form got no
-- throttling at all: a 1-minute monitor that is down sends one email per minute for as
-- long as the outage lasts. The default becomes 15; 0 stays legal for a user who
-- explicitly wants a notification per check.
--
-- SQLite cannot alter a column default in place, so the table is rebuilt — the same
-- create/copy/drop/rename shape earlier migrations in this directory use. The column list
-- is the table as the migrations leave it (`id`, `created_at`, `updated_at`, `team_id`,
-- `monitor_id`, `config`, `name`, `notify_on_recovery`, `cooldown_minutes`), and
-- `alerts_team_monitor_idx` is recreated afterwards because dropping the table drops its
-- indexes with it. No table has a foreign key referencing `alerts`, so no PRAGMA dance is
-- needed here.
--
-- Existing rows are deliberately NOT backfilled to 15: a default only applies to new rows,
-- and rewriting a value a user may be relying on is a silent behaviour change. The
-- per-incident send cap added in the same ADR is what bounds those rows.
--
-- `alert_events.status` also gains a `skipped_cap` value in this ADR. It needs no DDL: the
-- column is plain `TEXT NOT NULL` with no CHECK constraint, and the enum lives in
-- `database/schema.ts`.
CREATE TABLE `__new_alerts` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`monitor_id` text(36),
	`config` text NOT NULL,
	`name` text NOT NULL,
	`notify_on_recovery` integer DEFAULT 1 NOT NULL,
	`cooldown_minutes` integer DEFAULT 15 NOT NULL
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
