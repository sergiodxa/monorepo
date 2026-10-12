-- Migration number: 0012 	 2026-10-12T12:00:00.000Z

-- A topic is a saved search with a title and a Markdown description, listed at its own page
-- with its own feeds. `query` holds the canonical text `PostSearch.canonical` writes, so two
-- spellings of one search are one topic and the unique index means what it says.
CREATE TABLE "topics" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "query" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE UNIQUE INDEX "topics_slug" ON "topics" ("slug");
CREATE UNIQUE INDEX "topics_query" ON "topics" ("query");

-- The built-in kind topics, one per kind, with the titles and descriptions their pages
-- showed before topics existed. Their slugs are the kind registry's `topic`, which keeps
-- their slug and query fixed while the CMS edits their title and description.
INSERT INTO "topics" ("id", "slug", "title", "description", "query", "created_at", "updated_at")
VALUES
  ('019a1a00-0000-7000-8000-000000000001', 'articles', 'Articles', 'These are my articles.', 'kind:article', '2026-10-12T12:00:00.000Z', '2026-10-12T12:00:00.000Z'),
  ('019a1a00-0000-7000-8000-000000000002', 'tutorials', 'Tutorials', 'Learn about Remix, React, and more.', 'kind:tutorial', '2026-10-12T12:00:00.000Z', '2026-10-12T12:00:00.000Z'),
  ('019a1a00-0000-7000-8000-000000000003', 'glossary', 'Glossary', 'My definition of some terms.', 'kind:glossary', '2026-10-12T12:00:00.000Z', '2026-10-12T12:00:00.000Z'),
  ('019a1a00-0000-7000-8000-000000000004', 'bookmarks', 'Bookmarks', 'Links that I read and liked.', 'kind:bookmark', '2026-10-12T12:00:00.000Z', '2026-10-12T12:00:00.000Z');
