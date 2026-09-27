-- Bridges the gap between claiming a platform signup's email and verifying it: the
-- organization name submitted at `/signup` has nowhere else durable enough to survive
-- a resend, a slow inbox, or the worker recycling before the ticket is spent. Keyed on
-- the subject id `signup.verify` reads it back by, the same join key `verifyIdentifier`
-- itself resolves the ticket to — not a signup id of its own, since nothing but that
-- subject ever needs to look this row up.
--
-- Write-once-then-deleted, like `magic_link_attempts`: `created_at` alone is enough,
-- since a row that is never updated needs no `updated_at` to go with it.
CREATE TABLE pending_signups (
  subject_id TEXT PRIMARY KEY,
  organization_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
