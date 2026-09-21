-- A client's own switch for whether minting adds a `permissions` claim to its tokens,
-- alongside the `roles` claim every client already receives (see tokens.ts, roles.ts).
-- Off by default, so a client registered before this switch existed keeps carrying
-- exactly what it always has.
ALTER TABLE clients ADD COLUMN include_permissions INTEGER NOT NULL DEFAULT 0;
