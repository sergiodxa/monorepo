-- Migration number: 0009 	 2026-10-07T18:00:00.000Z

-- What the blog knows about each bookmark's address: one row per live bookmark, the address
-- duplicates are judged by (unique), the latest check of the page, the review state of a
-- flag the check raised, and the Wayback Machine capture being taken. The title, URL and
-- description stay in post_meta.
CREATE TABLE "bookmarks" (
  "post_id" TEXT PRIMARY KEY NOT NULL,
  "address" TEXT NOT NULL,
  "status" TEXT,
  "http_status" INTEGER,
  "final_url" TEXT,
  "checked_at" TEXT,
  "flag" TEXT,
  "flagged_at" TEXT,
  "reviewed_at" TEXT,
  "notified_at" TEXT,
  "described_at" TEXT,
  "archive_attempted_at" TEXT,
  "archive_job" TEXT,
  CONSTRAINT "fk_bookmarks_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "bookmarks_address" ON "bookmarks" ("address");

-- Every live bookmark with a URL gets its row, oldest first, so when two bookmarks share an
-- address the first one saved keeps it. The address is `LikePost.address`, spelled in SQL:
-- the URL without its scheme, its host (up to the first '/', '?' or '#') lowercased and
-- without a leading 'www.', and one trailing '/' dropped. Each meta key resolves to its
-- latest row (updated_at, then created_at), as the repository reads it.
WITH "latest" AS (
  SELECT "post_id", "key", "value",
    row_number() OVER (PARTITION BY "post_id", "key" ORDER BY "updated_at" DESC, "created_at" DESC) AS "position"
  FROM "post_meta"
),
"urls" AS (
  SELECT "posts"."id" AS "post_id", "posts"."created_at" AS "created_at", trim("latest"."value") AS "url"
  FROM "posts"
  JOIN "latest" ON "latest"."post_id" = "posts"."id" AND "latest"."key" = 'url' AND "latest"."position" = 1
  WHERE "posts"."type" = 'like' AND "posts"."deleted_at" IS NULL AND trim("latest"."value") <> ''
),
"rests" AS (
  SELECT "post_id", "created_at",
    CASE
      WHEN "url" LIKE 'https://%' THEN substr("url", 9)
      WHEN "url" LIKE 'http://%' THEN substr("url", 8)
      ELSE "url"
    END AS "rest"
  FROM "urls"
),
"splits" AS (
  SELECT "post_id", "created_at", "rest",
    min(
      CASE WHEN instr("rest", '/') > 0 THEN instr("rest", '/') ELSE length("rest") + 1 END,
      CASE WHEN instr("rest", '?') > 0 THEN instr("rest", '?') ELSE length("rest") + 1 END,
      CASE WHEN instr("rest", '#') > 0 THEN instr("rest", '#') ELSE length("rest") + 1 END
    ) AS "host_end"
  FROM "rests"
),
"hosts" AS (
  SELECT "post_id", "created_at",
    lower(substr("rest", 1, "host_end" - 1)) AS "host",
    substr("rest", "host_end") AS "tail"
  FROM "splits"
),
"addresses" AS (
  SELECT "post_id", "created_at",
    CASE WHEN "host" LIKE 'www.%' THEN substr("host", 5) ELSE "host" END || "tail" AS "address"
  FROM "hosts"
)
INSERT INTO "bookmarks" ("post_id", "address")
SELECT "post_id",
  CASE WHEN "address" LIKE '%/' THEN substr("address", 1, length("address") - 1) ELSE "address" END
FROM "addresses"
WHERE true
ORDER BY "created_at", "post_id"
ON CONFLICT ("address") DO NOTHING;

-- A live bookmark with a URL and no row lost its address to an older bookmark: it is a
-- duplicate, and it is tombstoned like any deleted post. Its search row goes with it.
WITH "latest" AS (
  SELECT "post_id", "key", "value",
    row_number() OVER (PARTITION BY "post_id", "key" ORDER BY "updated_at" DESC, "created_at" DESC) AS "position"
  FROM "post_meta"
)
UPDATE "posts"
SET "deleted_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "type" = 'like'
  AND "deleted_at" IS NULL
  AND "id" NOT IN (SELECT "post_id" FROM "bookmarks")
  AND "id" IN (
    SELECT "post_id" FROM "latest" WHERE "key" = 'url' AND "position" = 1 AND trim("value") <> ''
  );

DELETE FROM "post_search"
WHERE "post_id" IN (SELECT "id" FROM "posts" WHERE "type" = 'like' AND "deleted_at" IS NOT NULL);
