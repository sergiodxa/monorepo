-- Flow monitor Performance traces in R2 (ADR-037)
--
-- A nullable key on the result row points at the chrome://tracing JSON in the
-- FLOW_TRACES bucket. The object lives at most seven days; the result row keeps
-- its 90-day window. No index on `trace_key`: the nightly clean finds expired
-- traces through `checked_at`, which is already indexed.

ALTER TABLE flow_monitor_results ADD COLUMN trace_key TEXT;
