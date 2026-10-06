-- Migration number: 0006 	 2026-10-06T00:00:00.000Z

-- A search-only projection of each live article, tutorial and glossary entry: the text the
-- index matches, and the post it belongs to. Kind, publish state and everything a result
-- shows are read back from posts and post_meta, which stay the source of truth. "id" is the
-- integer the FTS5 rowid mirrors; a hard-deleted post takes its row with it.
CREATE TABLE "post_search" (
  "id" INTEGER PRIMARY KEY,
  "post_id" VARCHAR(36) NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "tags" TEXT NOT NULL DEFAULT '[]',
  "content" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "fk_post_search_post_id" FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE
);

-- The index holds only the inverted index; the text stays in post_search. The triggers
-- delete a rowid before inserting it because a trigger takes the conflict policy of the
-- statement that fired it: under the repository's upsert, INSERT OR REPLACE would leave the
-- old terms indexed beside the new ones.
CREATE VIRTUAL TABLE "post_search_fts" USING fts5(
  "title", "tags", "content",
  content='', contentless_delete=1,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER "post_search_fts_insert" AFTER INSERT ON "post_search" BEGIN
  DELETE FROM "post_search_fts" WHERE "rowid" = new."id";
  INSERT INTO "post_search_fts" ("rowid", "title", "tags", "content")
  VALUES (new."id", new."title", new."tags", new."content");
END;

CREATE TRIGGER "post_search_fts_update" AFTER UPDATE OF "title", "tags", "content" ON "post_search" BEGIN
  DELETE FROM "post_search_fts" WHERE "rowid" = old."id";
  INSERT INTO "post_search_fts" ("rowid", "title", "tags", "content")
  VALUES (new."id", new."title", new."tags", new."content");
END;

CREATE TRIGGER "post_search_fts_delete" AFTER DELETE ON "post_search" BEGIN
  DELETE FROM "post_search_fts" WHERE "rowid" = old."id";
END;

-- Backfill every live post the way the Post repository projects one: each meta key resolves
-- to its latest row (updated_at, then created_at); a glossary entry's title is its term then
-- its alias and its content is its definition; tutorial tags become a JSON array of trimmed,
-- distinct strings (a legacy plain-text value is one tag). Previews are projected too, since
-- a search reads publish state from posts. The insert trigger indexes every row this writes.
WITH "latest" AS (
  SELECT "post_id", "key", "value",
    row_number() OVER (PARTITION BY "post_id", "key" ORDER BY "updated_at" DESC, "created_at" DESC) AS "position"
  FROM "post_meta"
),
"documents" AS (
  SELECT
    "posts"."id" AS "post_id",
    "posts"."type" AS "kind",
    max(CASE WHEN "latest"."key" = 'title' THEN "latest"."value" END) AS "title",
    max(CASE WHEN "latest"."key" = 'term' THEN "latest"."value" END) AS "term",
    max(CASE WHEN "latest"."key" = 'content' THEN "latest"."value" END) AS "content",
    max(CASE WHEN "latest"."key" = 'definition' THEN "latest"."value" END) AS "definition",
    max(CASE WHEN "latest"."key" = 'tags' THEN "latest"."value" END) AS "tags"
  FROM "posts"
  LEFT JOIN "latest" ON "latest"."post_id" = "posts"."id" AND "latest"."position" = 1
  WHERE "posts"."type" IN ('article', 'tutorial', 'glossary') AND "posts"."deleted_at" IS NULL
  GROUP BY "posts"."id"
)
INSERT INTO "post_search" ("post_id", "title", "tags", "content")
SELECT
  "post_id",
  CASE
    WHEN "kind" = 'glossary' THEN trim(coalesce("term", '') || ' ' || coalesce("title", ''))
    ELSE coalesce("title", '')
  END,
  CASE
    WHEN "kind" <> 'tutorial' OR "tags" IS NULL OR trim("tags") = '' THEN '[]'
    WHEN NOT json_valid("tags") THEN json_array(trim("tags"))
    WHEN json_type("tags") <> 'array' THEN '[]'
    ELSE (
      SELECT json_group_array(DISTINCT trim("each"."value"))
      FROM json_each("documents"."tags") AS "each"
      WHERE "each"."type" = 'text' AND trim("each"."value") <> ''
    )
  END,
  CASE WHEN "kind" = 'glossary' THEN coalesce("definition", '') ELSE coalesce("content", '') END
FROM "documents";
