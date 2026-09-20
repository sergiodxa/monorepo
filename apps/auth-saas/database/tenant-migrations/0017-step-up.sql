-- Wires the TOTP mechanism into the authorization endpoint's step-up demand (see
-- authorization.ts, totp.ts). A pending interaction records the `acr_values`
-- demand `/authorize` read off the request, the same way it already records
-- `prompt` and `max_age`, and a step-up's own replay guard is scoped to the
-- interaction rather than the subject, so the same code proven for one
-- concurrent step-up is never mistaken for a replay of a different one.
ALTER TABLE authorization_requests ADD COLUMN acr_values TEXT;

CREATE TABLE totp_stepup_claims (
	interaction_id TEXT NOT NULL,
	subject_id TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	at INTEGER NOT NULL,
	PRIMARY KEY (interaction_id, code_hash)
);

CREATE INDEX totp_stepup_claims_by_time ON totp_stepup_claims (at);
