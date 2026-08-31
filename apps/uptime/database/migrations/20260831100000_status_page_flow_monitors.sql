-- Flow monitors on a public status page (ADR-027)
--
-- The sixth monitor type gets the join table the other five already have. A new table, so
-- there is nothing to migrate and nothing to back-fill, and `IF NOT EXISTS` keeps this
-- re-runnable.
--
-- Same shape as `status_page_dns_monitors`: a surrogate `id`, the curated `order` the page
-- renders in, and a `display_name` the team publishes the service under. `display_name` is
-- what makes an internal monitor name safe to keep internal, and it is the only text about a
-- flow this table stores — the spec source stays in `flow_monitors`, where nothing on the
-- public path reads it.
--
-- There is deliberately no foreign key and no cleanup of these rows when a flow monitor is
-- deleted. An attachment whose monitor is gone is skipped at render, which is how every other
-- type on this page already behaves; a dangling row costs one skipped lookup and nothing else.
--
-- Index review, by hand, per `AGENTS.md` and ADR-010:
--
--   * No `status_page_flow_monitors_id_unique`. `id` is a single-column PRIMARY KEY, so
--     SQLite already maintains an autoindex for it and an explicit unique index would only
--     cost a written row per insert and per delete — the mistake
--     `20260730100000_drop_duplicate_id_indexes.sql` removed everywhere else.
--   * `status_page_flow_monitors_page_idx` serves every read and every write this table has:
--     the public page and the edit form both list by `status_page_id`, and curation deletes
--     by it before re-inserting.
--   * No index on `flow_monitor_id`. Nothing seeks a flow's pages — the arrow only ever
--     points from a page to its flows — and an index nothing reads is still maintained.

CREATE TABLE IF NOT EXISTS `status_page_flow_monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status_page_id` text NOT NULL,
	`flow_monitor_id` text NOT NULL,
	`display_name` text,
	`order` integer DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS `status_page_flow_monitors_page_idx` ON `status_page_flow_monitors` (`status_page_id`);
