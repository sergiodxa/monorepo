-- Migration number: 0008 	 2026-10-07T12:00:00.000Z

-- Removes search rows for posts with nothing to find: a post with no metadata at all, which
-- no listing page shows, and a row whose title and content are both blank. The backfills read
-- metadata with a left join, so a post whose metadata was never saved got an empty row and
-- surfaced as a blank result. The repository no longer writes such rows; the delete trigger
-- takes each removed row out of the FTS5 index.
DELETE FROM "post_search"
WHERE NOT EXISTS (
    SELECT 1 FROM "post_meta" WHERE "post_meta"."post_id" = "post_search"."post_id"
  )
  OR (trim("title") = '' AND trim("content") = '');
