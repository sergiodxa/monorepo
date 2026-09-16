-- The one media file an entry attaches, kept on the canonical item so every subscriber
-- copies it rather than each of them parsing the document again.
--
-- Chosen at ingestion: the first attachment whose type begins with `audio/` or `video/`,
-- and no other. The feeds attaching fifteen files are attaching images, and a list of them
-- is a second table and a join on the read path for a feature whose whole value is a play
-- button.
--
-- No duration and no poster image, because no format reliably carries either.
ALTER TABLE items ADD COLUMN enclosure_url TEXT;
ALTER TABLE items ADD COLUMN enclosure_type TEXT;
ALTER TABLE items ADD COLUMN enclosure_length INTEGER;
