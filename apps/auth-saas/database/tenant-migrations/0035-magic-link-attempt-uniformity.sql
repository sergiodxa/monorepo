-- Equalizes a magic-link request's database cost regardless of whether the
-- address resolves to a subject: `completable` marks a row minted for an
-- address with no subject while just-in-time creation is off, so completion
-- can refuse it without a second lookup, and `interaction_id`/`return_to`
-- hold the resume destination the request itself named, so a later
-- completion resumes from what the server already stored rather than from
-- anything the token's own URL carries.
ALTER TABLE magic_link_attempts ADD COLUMN completable INTEGER NOT NULL DEFAULT 1;
ALTER TABLE magic_link_attempts ADD COLUMN interaction_id TEXT;
ALTER TABLE magic_link_attempts ADD COLUMN return_to TEXT;
