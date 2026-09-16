-- The canonical schema of one feed, applied to the SQLite that feed's object keeps of
-- its own. One object per feed, so nothing here is scoped by a feed id: the object is
-- the feed.
--
-- Timestamps are INTEGER epoch milliseconds throughout, for the reason the reader's own
-- schema gives: the keyset cursor encodes only strings, numbers and booleans, and the
-- SQL adapter binds values through without coercing a Date.

CREATE TABLE feed (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	feed_url TEXT NOT NULL,
	site_url TEXT,
	title TEXT NOT NULL,
	description TEXT,
	language TEXT,
	image_url TEXT,
	-- Validators echoed back on the next poll, so an unchanged feed answers 304.
	etag TEXT,
	last_modified TEXT,
	last_fetched_at INTEGER,
	-- The outcome category, kept apart from the numeric code and the message so a view
	-- can report a feed that 404s without parsing prose.
	last_status TEXT,
	last_http_status INTEGER,
	last_error TEXT,
	failure_count INTEGER NOT NULL DEFAULT 0,
	-- Backoff floor, so an origin that has been failing is not polled every firing.
	next_attempt_at INTEGER,
	-- The counter that issues both sequence and revision, and whose current value is
	-- the head this feed publishes. It lives in this row rather than being a rowid
	-- because SQLite reuses the highest rowid after a delete and retention deletes
	-- items: a counter that can go backwards would strand every cursor above it.
	head INTEGER NOT NULL DEFAULT 0,
	-- What this feed actually publishes, measured rather than guessed, so a reader can
	-- be offered a velocity that matches it. Measured once here and shared by everyone
	-- following the feed, the same way the fetch and the parse already are.
	posts_per_day REAL,
	-- Set when the last subscriber leaves, cleared when one arrives inside the week. An
	-- alarm firing with subscribers polls; an alarm firing without them purges.
	purge_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE items (
	id TEXT PRIMARY KEY,
	guid TEXT NOT NULL,
	-- Discovery order, assigned once and never moved, so it stays a record of when this
	-- object first saw the entry.
	sequence INTEGER NOT NULL,
	-- The order subscribers walk. An insert writes the same tick to both columns; an
	-- edit to an entry already known takes a fresh tick and writes it here alone, which
	-- is what puts a corrected post back in front of every subscriber exactly once.
	revision INTEGER NOT NULL,
	title TEXT NOT NULL,
	url TEXT,
	summary TEXT,
	author TEXT,
	-- NOT NULL, falling back to first-seen when a feed publishes no date, for the reason
	-- the reader's copy does the same: a nullable sort column leaves a hole in the index.
	published_at INTEGER NOT NULL,
	-- Digest of the displayable fields, so a poll that changed nothing writes nothing.
	content_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- Dedupe, and the correctness guarantee rather than an optimization: without it a feed
-- that re-serves an entry duplicates the row on every poll, forever. No feed id beside
-- it, because the object is the feed.
CREATE UNIQUE INDEX items_guid_idx ON items (guid);

-- The seek a subscriber synchronizes by: everything above their cursor, in order. It is
-- unique because each tick the head counter issues is used exactly once.
CREATE UNIQUE INDEX items_revision_idx ON items (revision);

-- The oldest-first scan the retention sweep makes.
CREATE INDEX items_published_idx ON items (published_at, id);

CREATE TABLE subscribers (
	user_id TEXT PRIMARY KEY,
	subscribed_at INTEGER NOT NULL
);
