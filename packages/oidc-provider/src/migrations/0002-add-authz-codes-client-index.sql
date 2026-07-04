-- Add index on authorization_codes.client_id for faster token exchange lookups
CREATE INDEX IF NOT EXISTS idx_authz_codes_client ON authorization_codes(client_id);
