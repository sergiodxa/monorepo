-- Wires the TOTP mechanism into sign-in (see totp.ts, passwords.ts). A session
-- records the class of proof a step-up verified and the instant it verified it,
-- independent of `amr`, so a later request can tell a check made moments ago from
-- a session holding a factor since morning.
ALTER TABLE sessions ADD COLUMN acr TEXT;
