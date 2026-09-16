-- Entitlement moves into the object that already holds the counts every limit is
-- compared against, so a follow, a save and an alarm each decide for themselves with a
-- local query and no network call.
--
-- Added rather than rebuilt: nothing here renames or retypes a column, and the four
-- defaults are what a reader who has never reached a checkout keeps forever.

-- What every limit check reads. Written only from outside, by the one RPC that takes a
-- snapshot; the object never computes it and has no path through which it could.
ALTER TABLE settings ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'
	CHECK (tier IN ('free', 'paid', 'premium'));

-- Whether the platform granted this tier or a person did. Reconciliation lowers a row
-- only when the platform put the value there, which is what makes a staff account, a
-- comp and a trial expressible without a schema change.
ALTER TABLE settings ADD COLUMN tier_source TEXT NOT NULL DEFAULT 'default'
	CHECK (tier_source IN ('default', 'billing', 'grant'));

-- When the lapse window runs out, and null while the reader has not lapsed. A failed
-- card sets it a fortnight out and moves no tier; a settled payment clears it.
ALTER TABLE settings ADD COLUMN grace_until INTEGER;

-- When a snapshot last confirmed the tier. It is both the staleness signal a sign-in
-- reads and the guard that makes two snapshots landing out of order converge: a write
-- carrying an older read is refused, so the later read wins whichever arrives second.
ALTER TABLE settings ADD COLUMN tier_checked_at INTEGER NOT NULL DEFAULT 0;
