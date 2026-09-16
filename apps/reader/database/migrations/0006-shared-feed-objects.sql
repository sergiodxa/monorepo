-- Ingestion moves out of this object and into one object per canonical feed, so a
-- subscription stops describing a fetch and starts describing a reader's relationship to
-- a feed somebody else's object is polling.
--
-- The tables are rebuilt rather than altered. Nothing here carries data forward: a
-- subscription's posts are materialized from the feed object it now points at, and there
-- is no feed id to point the old rows at, so the honest thing is to start from the
-- canonical copy rather than to invent one.

DROP TABLE feed_items;
DROP TABLE feeds;

CREATE TABLE feeds (
	id TEXT PRIMARY KEY,
	-- The catalog's identifier for the feed, copied in when the subscription is created.
	-- It names the object to synchronize from and builds the key the head is read from,
	-- so a reader who already follows a feed reaches everything about it without a
	-- lookup. The `id` beside it stays local and keeps its own meaning: it is what this
	-- app's own URLs are built from, scoped to one reader.
	feed_id TEXT NOT NULL,
	feed_url TEXT NOT NULL,
	site_url TEXT,
	title TEXT NOT NULL,
	description TEXT,
	language TEXT,
	image_url TEXT,
	-- The greatest revision this reader has ruled on, and the only synchronization state
	-- they keep. It is only ever set to a revision that came back from the feed and was
	-- written here, never to the head read from the shared index.
	cursor INTEGER NOT NULL DEFAULT 0,
	-- How long a post from this feed stays worth looking at, which is this reader's
	-- answer for this feed and nobody else's. Evergreen by default, so nothing ages out
	-- of any feed until somebody chooses otherwise.
	velocity TEXT NOT NULL DEFAULT 'evergreen'
		CHECK (velocity IN ('breaking', 'news', 'article', 'essay', 'evergreen')),
	-- Set when a reader unfollows a feed they still have saved posts from. The row stays
	-- to hold the feed's name for the saved list, and the subscription lists filter it
	-- out; it goes when the last saved post from the feed does.
	unfollowed_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX feeds_feed_url_idx ON feeds (feed_url);

-- One subscription per canonical feed, which is what makes a head read one key per row
-- and an arriving item land in exactly one subscription.
CREATE UNIQUE INDEX feeds_feed_id_idx ON feeds (feed_id);

CREATE INDEX feeds_subscription_idx ON feeds (created_at, id);

CREATE INDEX feeds_title_idx ON feeds (title, id);

CREATE TABLE feed_items (
	-- The canonical item id, minted by the feed object and copied verbatim, so the same
	-- item arriving twice is an upsert on a primary key rather than a duplicate. It is the
	-- whole of this row's identity now: telling an edited entry from an unchanged one is
	-- the feed's own work, done once for everybody following it, so no digest is kept here.
	id TEXT PRIMARY KEY,
	feed_id TEXT NOT NULL,
	guid TEXT NOT NULL,
	title TEXT NOT NULL,
	url TEXT,
	summary TEXT,
	author TEXT,
	published_at INTEGER NOT NULL,
	read_at INTEGER,
	-- When the reader asked to keep this post. A saved post is exempt from every rule
	-- that deletes one: the read sweep, the budget's reclamation, and its feed's
	-- velocity.
	saved_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX feed_items_timeline_idx ON feed_items (published_at, id);

CREATE INDEX feed_items_feed_timeline_idx ON feed_items (feed_id, published_at, id);

CREATE INDEX feed_items_unread_timeline_idx
	ON feed_items (published_at, id, feed_id) WHERE read_at IS NULL;

CREATE INDEX feed_items_read_timeline_idx
	ON feed_items (published_at, id, feed_id) WHERE read_at IS NOT NULL;

-- The saved list, paged by the same keyset as every other list in the app. Partial, so
-- it holds only what the reader asked to keep.
CREATE INDEX feed_items_saved_idx
	ON feed_items (published_at, id, feed_id) WHERE saved_at IS NOT NULL;

-- The cadence setting goes with the polling. A schedule belongs beside the document it
-- fetches, and that document now has an object of its own shared by everyone following
-- it, with no reader to ask how often to ask for it.
--
-- Rebuilt rather than altered: SQLite refuses to drop a column named by a `CHECK`, and
-- the cadence carried one listing the intervals on offer.
CREATE TABLE settings_next (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	subject TEXT NOT NULL,
	last_refreshed_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

INSERT INTO settings_next (id, subject, last_refreshed_at, created_at, updated_at)
	SELECT id, subject, last_refreshed_at, created_at, updated_at FROM settings;

DROP TABLE settings;

ALTER TABLE settings_next RENAME TO settings;
