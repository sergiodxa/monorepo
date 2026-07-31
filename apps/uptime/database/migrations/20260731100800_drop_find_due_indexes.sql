-- Migration: Drop the index the old scheduler query left behind (ADR-010, part 2)
--
-- ADR-003 moved scheduling onto `monitors.next_due_at`, so nothing reads `monitor_results`
-- to decide what is due. `monitor_results_created_at_idx` was left serving nothing: no plan
-- chooses it, including the two queries that filter on `created_at` (both lead with
-- `monitor_id`, which a single-column index cannot serve), so it cost a written row per
-- insert and per delete for nothing.
--
-- ADR-010 also called for dropping the `(monitor_id, completed_at, response_status,
-- response_time_ms)` composite. That is NOT done here: it is not scheduler-only, and
-- `/api/v1/status`' `ORDER BY completed_at DESC LIMIT 1` degrades from 31 VM steps to
-- 171,694 without it. See the ADR's implementation note.

DROP INDEX IF EXISTS `monitor_results_created_at_idx`;
