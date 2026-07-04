-- Add credential_id column to passkeys table.
-- This stores the WebAuthn credential ID from the authenticator,
-- which is needed for allowCredentials in authentication requests.
-- The existing `id` column is the database primary key (UUID).

ALTER TABLE passkeys ADD COLUMN credential_id TEXT;

-- For existing passkeys without credential_id, we can't recover the original
-- credential ID since it wasn't stored. Users will need to re-register.
-- New passkeys will have this field populated.
