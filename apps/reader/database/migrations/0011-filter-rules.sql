-- Rules a reader writes about what a post says, applied while the item is still in memory
-- on the synchronization path, and the mark the positive one leaves on a post.
--
-- One table, read whole. It is capped at a few dozen rows, so there is no index beyond the
-- primary key: a planner handed an index over fifty rows would decline it, and the read is
-- taken once per synchronization run rather than once per item.

-- A rule reads as a sentence: when the <field> of a post contains <value>, <action> it.
--
-- `feed_id` is null for a rule about the reader — it applies to every feed they follow,
-- including ones they follow later — and names a subscription for a rule about one
-- publication. Both are genuinely different questions and neither expresses the other, and
-- the nullable column is the whole implementation cost of supporting both.
--
-- `field` and `action` repeat their named lists as `CHECK`s, the way the velocity column
-- does, so the database refuses anything a form somehow lets through.
--
-- `matches` and `last_matched_at` are what a reader reads a rule's health off: a rule that
-- has never matched is the most common real failure, and it is visible at a glance. They
-- are written once per run with that run's total rather than once per item.
CREATE TABLE rules (
	id TEXT PRIMARY KEY,
	feed_id TEXT,
	field TEXT NOT NULL CHECK (field IN ('title', 'url', 'summary', 'author')),
	value TEXT NOT NULL,
	action TEXT NOT NULL CHECK (action IN ('drop', 'mark_read', 'flag')),
	matches INTEGER NOT NULL DEFAULT 0,
	last_matched_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- The mark a `flag` rule leaves, exactly the shape `saved_at` already has: a timestamp
-- rather than a boolean, so it answers when as well as whether. It carries no exemption
-- from anything — a flagged post ages out under its feed's velocity and is reclaimed by
-- the budget like any other — which is what makes it the action a rule may take where
-- saving is refused.
ALTER TABLE feed_items ADD COLUMN flagged_at INTEGER;

-- The flagged list, paged by the keyset every other filtered list here pages by. Partial,
-- so it holds only the posts a rule marked rather than a row per post the reader has.
CREATE INDEX feed_items_flagged_idx ON feed_items (published_at, id)
	WHERE flagged_at IS NOT NULL;
