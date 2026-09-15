-- The timeline of posts a reader has already read, which the reading queue offers as one
-- of the three states it filters by. Partial, the way the unread index is, so it holds
-- only read rows — and those are the rows that accumulate, since a post is read once and
-- stays read for as long as it is stored. That makes this the filter with the most rows
-- to walk and the one that most needs walking them in order.
--
-- feed_id rides along as a covering column, so listing read posts never leaves the index
-- to learn which feed each one came from. Both keys point the same way, so an ascending
-- index answers the descending order by being scanned backwards and declaring DESC buys
-- nothing. What matters is that the plan needs no temporary b-tree to sort.
CREATE INDEX feed_items_read_timeline_idx
	ON feed_items (published_at, id, feed_id) WHERE read_at IS NOT NULL;
