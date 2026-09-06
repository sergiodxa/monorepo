-- The per-reader schema, applied to the SQLite each user object keeps of its own.
--
-- Timestamps are INTEGER epoch milliseconds throughout. That is not a style choice.
-- The keyset cursor encodes only strings, numbers and booleans, and the SQL adapter
-- binds values through without coercing a Date, so integer milliseconds is the one
-- representation that binds, sorts, and encodes into a cursor unchanged.

CREATE TABLE settings (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	subject TEXT NOT NULL,
	refresh_interval_hours INTEGER NOT NULL DEFAULT 1
		CHECK (refresh_interval_hours IN (1, 3, 6, 9, 12, 24)),
	last_refreshed_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE feeds (
	id TEXT PRIMARY KEY,
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
	-- The outcome category, kept apart from the numeric code and the message so a
	-- view can report a feed that 404s without parsing prose.
	last_status TEXT,
	last_http_status INTEGER,
	last_error TEXT,
	failure_count INTEGER NOT NULL DEFAULT 0,
	-- Backoff floor, so a feed that has been failing is not retried every hour.
	next_attempt_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX feeds_feed_url_idx ON feeds (feed_url);

CREATE TABLE feed_items (
	id TEXT PRIMARY KEY,
	feed_id TEXT NOT NULL,
	guid TEXT NOT NULL,
	title TEXT NOT NULL,
	url TEXT,
	summary TEXT,
	content TEXT,
	author TEXT,
	-- NOT NULL, falling back to first-seen when a feed publishes no date. A nullable
	-- sort column would put NULL ordering into the seek predicate and leave a hole in
	-- the index. A total ordering is what makes the cursor arithmetic correct.
	published_at INTEGER NOT NULL,
	-- Digest of the displayable fields, so a poll that changed nothing writes nothing.
	content_hash TEXT NOT NULL,
	read_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- Dedupe. Uniqueness is the correctness guarantee rather than an optimization.
-- Without it, a feed that re-serves an entry with a jittered date duplicates the row
-- on every poll, forever. The leading feed_id also serves the pre-write prefetch.
CREATE UNIQUE INDEX feed_items_feed_guid_idx ON feed_items (feed_id, guid);

-- The ordering the global timeline reads in. SQLite reverse-scans an ascending index
-- to satisfy a descending order, so declaring DESC buys nothing while both keys point
-- the same way. What matters is that the plan needs no temporary b-tree to sort.
CREATE INDEX feed_items_timeline_idx ON feed_items (published_at, id);

-- The timeline of one feed, and the oldest-first scan the retention sweep makes.
CREATE INDEX feed_items_feed_timeline_idx ON feed_items (feed_id, published_at, id);

-- The unread timeline. Partial, so it holds only unread rows and shrinks as the
-- reader reads. feed_id rides along as a covering column, so listing unread posts
-- never leaves the index to learn which feed each one came from.
CREATE INDEX feed_items_unread_timeline_idx
	ON feed_items (published_at, id, feed_id) WHERE read_at IS NULL;
