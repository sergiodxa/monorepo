-- Drops the post body, which was stored but never read: a reader's list renders the
-- title, the summary and the author, and the body behind them was only ever fetched,
-- capped and hashed. A Durable Object's storage is what it costs, so it goes.

-- The digest that tells an edited post from an unchanged one is taken over the fields a
-- reader sees, and the body was one of them, so every hash already stored was taken over
-- a wider projection than the next one will be. The first poll after this reads every
-- stored post as edited and writes an update for each: a one-time cost, per feed, paid
-- once. Those updates carry only the displayable fields and the new digest, so a read
-- post stays read, keeps the id its links were built from, and keeps the publication
-- date the timeline's cursors seek on.
ALTER TABLE feed_items DROP COLUMN content;
