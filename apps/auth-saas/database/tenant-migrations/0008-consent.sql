CREATE TABLE IF NOT EXISTS scopes (
	name TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	description TEXT NOT NULL,
	claims TEXT NOT NULL,
	is_standard INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

-- The standard OIDC scopes every tenant starts with. Guarded so a rerun of this migration
-- leaves a tenant's own edits to these rows alone rather than stamping over them.
INSERT OR IGNORE INTO scopes (name, title, description, claims, is_standard, created_at) VALUES
	('openid', 'Sign you in', 'Confirms who you are.', '[]', 1, 0),
	('profile', 'Your profile', 'Your name, picture, and other basic profile details.', '["name","given_name","family_name","nickname","preferred_username","picture","locale","zoneinfo"]', 1, 0),
	('email', 'Your email address', 'Your email address and whether it has been verified.', '["email","email_verified"]', 1, 0),
	('address', 'Your address', 'Your postal address.', '["address"]', 1, 0),
	('offline_access', 'Stay signed in', 'Access to your account while you are not present.', '[]', 1, 0);

-- One person's standing decision about one client: which scopes they have agreed to give
-- it. The pair is the whole identity of a grant, so a second decision for the same pair
-- updates this row rather than adding another.
CREATE TABLE IF NOT EXISTS grants (
	subject_id TEXT NOT NULL,
	client_id TEXT NOT NULL,
	scopes TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (subject_id, client_id)
);

-- What listGrants pages by: a subject's own grants, newest first, with client_id riding
-- along as the tiebreaker a keyset cursor needs since created_at alone is not unique.
CREATE INDEX IF NOT EXISTS grants_by_subject ON grants (subject_id, created_at, client_id);
