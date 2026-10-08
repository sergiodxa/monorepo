-- Migration number: 0011 	 2026-10-07T21:00:00.000Z

-- When the post's `Create` was sent to the ActivityPub followers, which decides whether its
-- next change federates as a `Create` or an `Update`, and whether a delete sends `Delete`.
ALTER TABLE "posts" ADD COLUMN "federated_at" TEXT;

-- Articles and tutorials already public count as federated, so the scheduled job never
-- backfills every old post into followers' timelines; their later edits send `Update`.
UPDATE "posts"
SET "federated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "type" IN ('article', 'tutorial')
  AND "deleted_at" IS NULL
  AND ("published_at" IS NULL OR "published_at" <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
