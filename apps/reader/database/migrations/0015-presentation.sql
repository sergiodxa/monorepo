-- What a reader may change about how their feed looks, and the attachment a post arrives
-- with.
--
-- The first two are per reader because they are facts about eyes and screens: somebody who
-- wants dark wants it for every feed. The third is per subscription for the reason velocity
-- is — two people following one comic disagree about whether they want the picture or the
-- line, and neither is wrong — so it lands on the object each of them owns rather than the
-- one they share.

-- The scheme the document is painted in. Its three names are the vocabulary the theme layer
-- already reads off an ancestor class, so nothing translates between this column and the
-- class the document wears.
ALTER TABLE settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'
	CHECK (theme IN ('system', 'light', 'dark'));

-- The face a post's title and its words are set in, which never reaches the chrome: a serif
-- sidebar is not what anybody asking for serif is asking for.
ALTER TABLE settings ADD COLUMN reading_face TEXT NOT NULL DEFAULT 'sans'
	CHECK (reading_face IN ('sans', 'serif'));

-- How this subscription's posts are drawn. A mode rather than a boolean, so a third
-- rendering is a value rather than a second column.
ALTER TABLE feeds ADD COLUMN presentation TEXT NOT NULL DEFAULT 'text'
	CHECK (presentation IN ('text', 'image'));

-- The one media file a post arrives with, copied from the canonical item by the same
-- synchronization that copies the title and the link. At most one: a podcast item has one
-- episode, and an arbitrary-length list is a second table and a join on the read path for a
-- feature whose whole value is a play button.
--
-- Three nulls is what a post with no media enclosure holds, and it renders exactly as it
-- did before these columns existed.
ALTER TABLE feed_items ADD COLUMN enclosure_url TEXT;
ALTER TABLE feed_items ADD COLUMN enclosure_type TEXT;
ALTER TABLE feed_items ADD COLUMN enclosure_length INTEGER;
