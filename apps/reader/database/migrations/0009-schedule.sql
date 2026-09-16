-- The clock the freshness comparison runs on. A reader's object has one alarm, and three
-- jobs now want it, so what is due is derived from three due times with one writer each
-- rather than remembered by the alarm itself.
--
-- Added rather than rebuilt: nothing here renames or retypes a column, and every default
-- is null, which is what a reader on a tier that arms no wake keeps forever.

-- When the reader last opened the reader, which is what the dormancy ladder measures from.
-- Null until the first open, which reads as an active reader: an object migrated before
-- this column existed has an open behind it that nothing recorded.
ALTER TABLE settings ADD COLUMN last_opened_at INTEGER;

-- When the next scheduled freshness check is due, and null for a tier that arms none.
ALTER TABLE settings ADD COLUMN next_check_at INTEGER;

-- When the next retention sweep is due. It is what ages a velocity window out of an
-- object that synchronizes nothing, since a window closes whether or not the feed moved.
ALTER TABLE settings ADD COLUMN next_sweep_at INTEGER;

-- When the leftovers of a run that hit its per-run bound carry on, and null while there
-- are none.
ALTER TABLE settings ADD COLUMN next_catch_up_at INTEGER;
