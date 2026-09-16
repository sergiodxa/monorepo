-- Queries a reader kept, so a search worth typing twice is typed once.
--
-- A saved search holds a narrowing and nothing else: the rail draws it as the queue's own
-- address, so opening one is the same controller, the same statement and the same cursor
-- grammar as typing the words it holds. Nothing here renders posts.

-- `read_state` repeats the three states the queue offers as a `CHECK`, the way the velocity
-- column repeats its own list, so the database refuses anything a form somehow lets through.
--
-- `feed_id` is this app's own subscription id, and null is a search across every feed the
-- reader follows, including ones they follow later.
--
-- No column counts anything. A number beside each entry is a scan per entry on every page
-- of the app, paid by readers who are not searching.
CREATE TABLE searches (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	query TEXT NOT NULL,
	read_state TEXT NOT NULL CHECK (read_state IN ('all', 'unread', 'read')),
	feed_id TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- The list, paged by keyset the way the rail's feeds are: the name leads because that is
-- the order the entries are read in, and the id breaks a tie between two readers gave the
-- same name.
CREATE INDEX searches_name_idx ON searches (name, id);
