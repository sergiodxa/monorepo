-- Tracks the one attack-signal alert a tenant may receive per day (see
-- app/jobs/check-attack-signal-baseline.ts and app/models/attack-signal-alert.ts):
-- a row's presence for a (tenant_id, day) pair means that day's alert already went
-- out, so a rerun of the job finds it and sends nothing more.
CREATE TABLE attack_signal_alerts (
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  day INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, day)
);
