-- Migration number: 0007 	 2026-10-07T00:00:00.000Z

-- Bookmarks (posts of type like) join the search projection: the title the reader saved the
-- page under, and as content its address without the scheme, so the site's name and path words
-- find it while "https" never does. A bare host is read as https, as the bookmark pages link it.
-- Each meta key resolves to its latest row (updated_at, then created_at), as in 0006. A row
-- already there is left as the repository wrote it, and the insert trigger indexes the rest.
WITH "latest" AS (
  SELECT "post_id", "key", "value",
    row_number() OVER (PARTITION BY "post_id", "key" ORDER BY "updated_at" DESC, "created_at" DESC) AS "position"
  FROM "post_meta"
),
"bookmarks" AS (
  SELECT
    "posts"."id" AS "post_id",
    coalesce(max(CASE WHEN "latest"."key" = 'title' THEN "latest"."value" END), '') AS "title",
    coalesce(max(CASE WHEN "latest"."key" = 'url' THEN "latest"."value" END), '') AS "url"
  FROM "posts"
  LEFT JOIN "latest" ON "latest"."post_id" = "posts"."id" AND "latest"."position" = 1
  WHERE "posts"."type" = 'like' AND "posts"."deleted_at" IS NULL
  GROUP BY "posts"."id"
)
INSERT INTO "post_search" ("post_id", "title", "tags", "content")
SELECT
  "post_id",
  "title",
  '[]',
  CASE
    WHEN "url" LIKE 'https://%' THEN substr("url", 9)
    WHEN "url" LIKE 'http://%' THEN substr("url", 8)
    ELSE "url"
  END
FROM "bookmarks"
WHERE true
ON CONFLICT ("post_id") DO NOTHING;
