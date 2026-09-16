-- Labels a reader puts on the posts they kept, a mark on a subscription they never want
-- to miss, and the measured rate a rarely-publishing feed is grouped by.
--
-- Two tables rather than a delimited column on the posts. The question the feature exists
-- to answer is "the posts under this label, newest first", and a value in the middle of a
-- list is a value no index can seek: that list would be the only one in this schema that
-- sorts rather than seeks, and a list that cannot seek cannot page by keyset.

-- The label itself, held by an id so renaming it breaks no link and rewrites no post. The
-- name is what the reader typed; the slug is the folded form uniqueness is taken over.
CREATE TABLE tags (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	slug TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- One tag per folded name, so `Rust` and `rust` are one label wearing the name it was
-- first given rather than two rows a reader cannot tell apart.
CREATE UNIQUE INDEX tags_slug_idx ON tags (slug);

-- Which posts carry which label. The composite primary key makes applying a tag twice a
-- no-op the database decides rather than a count taken first.
--
-- `published_at` is a copy of the post's own, which is what puts the filter and both
-- ordering columns in one index: no index spans two tables, so without it the planner
-- filters, joins and sorts into a temporary b-tree on every page. The copy is safe
-- because that column is frozen against a publisher's edits — it leads the timeline's
-- ordering, and a row that moved within it would make an in-flight cursor skip posts —
-- so there is nothing to reconcile and the value is written once, by the statement that
-- applies the tag.
CREATE TABLE item_tags (
	tag_id TEXT NOT NULL,
	item_id TEXT NOT NULL,
	published_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (tag_id, item_id)
);

-- A page of one label: one equality, a range on the cursor, and fifty entries walked back
-- from where it lands. Both keys point the same way, so an ascending index answers the
-- descending order by being scanned backwards and declaring DESC buys nothing.
CREATE UNIQUE INDEX item_tags_timeline_idx ON item_tags (tag_id, published_at, item_id);

-- The other direction: the chips drawn on a post, and the delete that clears a post's
-- labels when the post goes, which without it is a scan.
CREATE INDEX item_tags_item_idx ON item_tags (item_id);

-- A subscription the reader never wants to miss, drawn in a strip above the river. A
-- timestamp rather than a boolean, the shape `read_at`, `saved_at` and `unfollowed_at`
-- already have: it answers when as well as whether, so pin order is an ordering the reader
-- produced. No index covers it — the rail already reads every subscription, so the pinned
-- set is a partition of rows in memory rather than a statement of its own.
ALTER TABLE feeds ADD COLUMN pinned_at INTEGER;

-- What the feed publishes, in posts per day, as the feed's own object measured it and
-- handed it back. It is stamped from conversations the reader's object was having anyway —
-- following, synchronizing, and asking after a feed's health — so nothing walks the
-- subscriptions to keep it, and it is never recomputed locally, which would measure this
-- reader's velocity as much as the publisher's rate.
ALTER TABLE feeds ADD COLUMN posts_per_day REAL;
