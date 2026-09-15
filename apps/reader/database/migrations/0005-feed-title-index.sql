-- The ordering the rail reads its subscriptions in. Every followed feed is drawn there,
-- so the list is walked a page at a time and a page boundary has to fall somewhere a
-- reader can predict: the names, in order. Left to sort, SQLite reads every feed of a
-- reader into a temporary b-tree on every page.
--
-- Both keys point the same way, so an ascending index answers a descending order by being
-- scanned backwards and declaring DESC buys nothing. The id joins the key to make the
-- ordering total, which is what lets a cursor resume at exactly one row when two feeds
-- share a title.
CREATE INDEX feeds_title_idx ON feeds (title, id);
