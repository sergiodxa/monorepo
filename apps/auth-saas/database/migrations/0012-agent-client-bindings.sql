-- A machine credential authenticates against the platform tenant's own token
-- endpoint like any other client, but nothing about that proves which tenant it
-- may act for -- there is no person behind it a membership row could resolve.
-- This table names that fact once, at registration, so the management API's own
-- bearer verification can look it up the same way a membership is looked up for
-- an interactively-obtained token.
CREATE TABLE agent_client_bindings (
  client_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
