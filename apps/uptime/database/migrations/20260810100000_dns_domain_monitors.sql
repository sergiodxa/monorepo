-- A DNS monitor watches a domain, not a record type (ADR-026)
--
-- The old shape was one row per (domain, record type, expected value). The new one is one
-- monitor per domain plus a record table whose identity is `(name, record_type, value)`, so
-- a sixth MX appearing beside five existing ones reads as one addition rather than as "the
-- MX records changed".
--
-- This drops and recreates rather than altering, which is legal on exactly one fact,
-- verified against production before this was written rather than assumed:
--
--   SELECT count(*) FROM dns_monitors         -> 0
--   SELECT count(*) FROM dns_monitor_results  -> 0
--
-- There is therefore nothing to back-fill and no data migration to write. `IF EXISTS` on
-- the drops keeps this re-runnable against a database that never had the tables, and the
-- `CREATE`s below are the complete definition, so an empty table and a missing table both
-- end in the same place.
--
-- Index review, by hand, per `apps/uptime/AGENTS.md` and ADR-010:
--
--   * `dns_monitors_id_unique` / `dns_monitor_results_id_unique` are NOT re-emitted. Both
--     were dropped on purpose in `20260730100000_drop_duplicate_id_indexes.sql`: `id` is
--     already a single-column PRIMARY KEY, so SQLite maintains an autoindex for it and the
--     explicit unique index only costs a written row per insert and per delete. Recreating
--     a table is exactly where they creep back in.
--   * `dns_monitor_results_checked_at_idx` IS re-created. ADR-020 added no index of its own
--     to this table only because this one already served the retention sweep's
--     `WHERE checked_at < ?`, so dropping the table would have taken `CleanJob`'s index with
--     it and turned the nightly delete into a full scan.
--   * `dns_monitors_is_enabled_idx` is deliberately NOT re-created. Nothing seeks on
--     `is_enabled` alone: the sweep claims on `next_due_at` (ADR-006 —
--     `20260731100500_tcp_dns_next_due_at.sql` says so in its own comment), and the team and
--     digest reads filter `team_id` first, which `dns_monitors_team_idx` leads on. Carrying
--     a dead index through a recreate would be the ADR-010 mistake made twice.
--   * `dns_monitor_records` gets no `(dns_monitor_id, name, record_type)` index of its own.
--     That column list is the leading prefix of the unique index below, and SQLite seeks
--     into a composite index by prefix, so a separate one would be a second B-tree
--     maintained for query plans the first already serves.
--   * `dns_monitor_records` gets no retention sweep and no date index. It is configuration —
--     the complete set of everything ever seen for the domain — not history.

DROP TABLE IF EXISTS `dns_monitor_results`;
DROP TABLE IF EXISTS `dns_monitors`;

-- One monitor per domain. `record_type`, `expected_value` and `last_value` are gone: the
-- first is a dimension of the record table, the second is superseded by importing the
-- expectation instead of transcribing it, and the third was a single joined blob that
-- cannot represent a per-record baseline.
CREATE TABLE `dns_monitors` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`team_id` text(36) NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	-- When a zone file was last pasted and parsed. The text itself is never stored; NULL
	-- means every tracked name was discovered by resolution, which covers the apex only.
	`zone_file_imported_at` integer,
	-- Daily. DNS changes are human-paced, and a record's TTL floors detection latency below
	-- anything a faster interval could reach.
	`interval_seconds` integer DEFAULT 86400 NOT NULL,
	`next_due_at` integer,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`last_checked_at` integer,
	`last_status` text
);

CREATE INDEX `dns_monitors_team_idx` ON `dns_monitors` (`team_id`);

CREATE INDEX `dns_monitors_next_due_at_idx` ON `dns_monitors` (`next_due_at`);

-- One row per tracked record. `is_enabled = 0` rows are kept rather than deleted: the table
-- is the complete set of everything ever seen for the domain, and a record the user declined
-- to watch would otherwise be rediscovered as `new` on the very next check and alert forever.
CREATE TABLE `dns_monitor_records` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`dns_monitor_id` text(36) NOT NULL,
	-- Absolute owner name, lowercased, no trailing dot. The apex is `dns_monitors.domain`.
	`name` text NOT NULL,
	`record_type` text NOT NULL,
	-- Normalized RDATA, folded per type at write time so a zone-file line and a resolver
	-- answer for the same record produce the same string.
	`value` text NOT NULL,
	`source` text NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer,
	`last_checked_at` integer
);

-- Record identity. A DNS record has none of its own — an RRset is a set of RDATA — so the
-- normalized value is part of the key, which is what makes an added record an INSERT and
-- leaves its siblings untouched.
CREATE UNIQUE INDEX `dns_monitor_records_identity_unique` ON `dns_monitor_records` (`dns_monitor_id`, `name`, `record_type`, `value`);

-- The "what needs my attention" list on the monitor's page.
CREATE INDEX `dns_monitor_records_status_idx` ON `dns_monitor_records` (`dns_monitor_id`, `status`);

-- One row per check of the monitor, not per query: per-query rows would multiply retention
-- volume by the number of names swept for data nothing renders.
CREATE TABLE `dns_monitor_results` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`dns_monitor_id` text(36) NOT NULL,
	`status` text NOT NULL,
	`records_checked` integer DEFAULT 0 NOT NULL,
	`records_changed` integer DEFAULT 0 NOT NULL,
	`records_missing` integer DEFAULT 0 NOT NULL,
	`records_new` integer DEFAULT 0 NOT NULL,
	-- Queries that did not answer. A failed query is never diffed, so a partial sweep must
	-- be recorded as partial and never read as "these records are missing".
	`queries_failed` integer DEFAULT 0 NOT NULL,
	-- The slowest single query in the sweep, not the sum: this feeds a latency chart, and a
	-- sum would quietly turn it into a cost chart.
	`response_time_ms` integer,
	`error_message` text,
	`checked_at` integer NOT NULL
);

CREATE INDEX `dns_monitor_results_dns_monitor_idx` ON `dns_monitor_results` (`dns_monitor_id`);

CREATE INDEX `dns_monitor_results_checked_at_idx` ON `dns_monitor_results` (`checked_at`);
