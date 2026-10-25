-- What RFC 5005 (Feed Paging and Archiving) asks this object to remember.
--
-- removed_at marks an item a complete feed (fh:complete) stopped listing, which means it
-- left the feed. The row stays as a tombstone that takes a fresh revision, so every
-- subscriber walking the order learns of the removal the same way they learn of an edit.
-- The item comes back, with removed_at cleared, if the feed lists it again.
ALTER TABLE items ADD COLUMN removed_at INTEGER;

-- One row per archive or page document a history walk has stored. The validators make the
-- next request for that document conditional. next_url is the link the walk followed from
-- it, so a walk retried after a failure moves past a page answered with 304 without parsing
-- it again.
CREATE TABLE pages (
	url TEXT PRIMARY KEY,
	etag TEXT,
	last_modified TEXT,
	next_url TEXT,
	fetched_at INTEGER NOT NULL
);
