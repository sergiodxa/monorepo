-- The feed catalog, applied to the D1 database bound as PLATFORM_DB through
-- `wrangler d1 migrations`. One row per canonical feed the system has ever created.
--
-- Timestamps are INTEGER epoch milliseconds, the way every other table in this app
-- spells them, so a value binds, sorts and compares the same wherever it is read.

CREATE TABLE feeds (
	-- A feed_… TypeID. There is no do_name column beside it: the id is the name, so a
	-- feed's object is reachable from its row by getByName(row.id), and from a reader's
	-- subscription without a row at all.
	id TEXT PRIMARY KEY,
	feed_url TEXT NOT NULL,
	-- A denormalized copy of what the feed's object holds, so a list is readable and
	-- searchable without waking anything.
	title TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	-- Stamped where a poll publishes a head, so it moves only when something was stored.
	last_active_at INTEGER,
	-- Set when the last subscriber leaves, and cleared when one arrives inside the grace
	-- period, so a feed serving out its week keeps its id, its object and its items.
	retired_at INTEGER
);

-- The convergence guarantee, and the reason the follow path can be an upsert at all:
-- two people following one URL in the same second both go through this index and come
-- out with one row, therefore one id, therefore one object.
CREATE UNIQUE INDEX feeds_feed_url_idx ON feeds (feed_url);

-- The ordering an administrative list pages in, spelled the way every other paged list
-- in this app is. The id joins the key to make the ordering total, which is what lets a
-- cursor resume at exactly one row when two feeds were indexed in the same millisecond.
CREATE INDEX feeds_created_at_idx ON feeds (created_at, id);
