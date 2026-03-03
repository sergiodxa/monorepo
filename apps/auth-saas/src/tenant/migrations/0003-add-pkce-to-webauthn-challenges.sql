-- Add PKCE columns to webauthn_challenges table for OAuth 2.1 compliance
-- This ensures PKCE protection is maintained through the WebAuthn flow
ALTER TABLE webauthn_challenges ADD COLUMN pkce_challenge TEXT;
ALTER TABLE webauthn_challenges ADD COLUMN pkce_method TEXT CHECK(pkce_method IN ('S256', 'plain'));
