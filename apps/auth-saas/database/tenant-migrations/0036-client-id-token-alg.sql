-- The algorithm a client's ID tokens are signed with (OIDC Dynamic Client Registration
-- `id_token_signed_response_alg`), ES256 or RS256. ES256 by default, so a client
-- registered before this column existed keeps verifying the tokens it always has.
ALTER TABLE clients ADD COLUMN id_token_signed_response_alg TEXT NOT NULL DEFAULT 'ES256';
