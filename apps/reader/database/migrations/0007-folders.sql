-- Named groups of subscriptions, so a reader between "every feed" and "one feed" has a
-- stream of the group they chose. A folder is a reading surface before it is a filing
-- cabinet, which is what decides everything below: the group has to page by the same
-- keyset seek every other list in this app pages by.
--
-- Flat, with no parent and no position. A nested folder makes "the posts in this folder"
-- mean "and everything under it", which reads either as a list of feeds or as a prefix
-- match, and both leave the ordering columns unsorted — a temporary b-tree over every
-- matching row in the object, on every page.

CREATE TABLE folders (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- One folder per name, which keeps the rail from drawing two rows a reader cannot tell
-- apart and makes filing by name an upsert — what an import needs to be idempotent. It is
-- also the whole of the ordering: a unique title needs no tiebreaker, so this one index
-- answers both the constraint and the order the rail draws the names in.
--
-- Uniqueness is over bytes, as everywhere else in this schema, so `Tech` and `tech` are
-- two folders, which is visible enough in a rail to be fixed by renaming one.
CREATE UNIQUE INDEX folders_title_idx ON folders (title);

-- A feed is in one folder or in none, and no index covers it: the subscription list is
-- hundreds of rows, the rail reads all of it anyway, and the one query that filters it by
-- folder is a deletion clearing its members.
ALTER TABLE feeds ADD COLUMN folder_id TEXT REFERENCES folders (id);

-- The folder copied onto the post, which is what turns the group's timeline into a seek.
-- It has exactly one source — the `folder_id` of the subscription the post belongs to —
-- and synchronization writes it from the row it is already holding on insert and on
-- conflict alike, so a move that failed halfway heals on the next poll.
--
-- It joins none of the frozen columns. `read_at`, `id` and `published_at` are held against
-- a publisher's edit because a reader has ruled on them and because two of them are the
-- cursor; this one is written by the reader alone and orders nothing, so filing a feed
-- moves no row within `(published_at, id)`.
ALTER TABLE feed_items ADD COLUMN folder_id TEXT;

-- A page of a folder is a page of one feed with the leading column changed: one equality,
-- a range on the next, and fifty entries walked backwards from where the cursor lands. Both
-- keys point the same way, so an ascending index answers the descending order by being
-- scanned backwards and declaring DESC buys nothing.
--
-- Partial, the way the read, unread and saved indexes are, which is what makes an unfiled
-- post cost nothing. A folder's timeline always seeks a folder that exists, so the
-- predicate never excludes a row the query wanted.
CREATE INDEX feed_items_folder_timeline_idx
	ON feed_items (folder_id, published_at, id) WHERE folder_id IS NOT NULL;
