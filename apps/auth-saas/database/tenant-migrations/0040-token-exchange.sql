-- The audiences a client may exchange a token for (RFC 8693), as a JSON list. A client
-- holding none, which is every client registered before this column existed, may not
-- use the token exchange grant at all.
ALTER TABLE clients ADD COLUMN token_exchange_audiences TEXT;
