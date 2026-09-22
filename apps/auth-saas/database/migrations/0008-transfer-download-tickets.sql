-- A single-use, hashed ticket naming an R2 object key a transfer run wrote,
-- spent once by the management API route that streams the object back — the
-- same delete-then-check-expiry idiom `pending_link_tickets` and
-- `password_reset_tickets` already use, so a replayed spend always finds
-- nothing left to take. Control-plane rather than per-tenant, matching where
-- the run that wrote the object is itself tracked, in `tenant_import_runs`.
CREATE TABLE transfer_download_tickets (
  id TEXT PRIMARY KEY,
  ticket_hash TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX transfer_download_tickets_ticket_hash_idx ON transfer_download_tickets (ticket_hash);

CREATE INDEX transfer_download_tickets_by_expiry ON transfer_download_tickets (expires_at);
