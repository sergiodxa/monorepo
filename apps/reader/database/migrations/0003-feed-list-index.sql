-- The ordering the subscription list reads in. It pages by keyset on (created_at, id),
-- and that seek is a seek only while an index carries both keys in that order. Left to
-- sort, SQLite reads every feed of a reader into a temporary b-tree, on every page.
--
-- Both keys point the same way, so an ascending index answers the descending order by
-- being scanned backwards and declaring DESC buys nothing. The id joins the key to make
-- the ordering total, which is what lets a cursor resume at exactly one row.
CREATE INDEX feeds_subscription_idx ON feeds (created_at, id);
