-- Add index on signing_keys.is_current for faster current key lookups
-- This is a hot path called on every token operation
CREATE INDEX IF NOT EXISTS idx_signing_keys_current ON signing_keys(is_current);
