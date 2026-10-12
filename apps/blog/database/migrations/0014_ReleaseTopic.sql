-- Migration number: 0014 	 2026-10-12T14:00:00.000Z

-- The kind topic of the weekly releases posts, listed at `/releases` with its own feeds. Its
-- slug is the kind registry's `topic` for releases, and its query the kind's own name.
INSERT INTO "topics" ("id", "slug", "title", "description", "query", "created_at", "updated_at")
VALUES
  ('019a1a00-0000-7000-8000-000000000007', 'releases', 'Releases', 'The packages I released each week.', 'kind:release', '2026-10-12T14:00:00.000Z', '2026-10-12T14:00:00.000Z');
