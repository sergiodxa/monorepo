-- Migration number: 0013 	 2026-10-12T13:00:00.000Z

-- The kind topics of notes and TILs, listed at `/notes` and `/til` with their own feeds. Their
-- slugs are the kind registry's `topic` and their queries the canonical `kind:` search, both
-- fixed while the CMS edits the title and description.
INSERT INTO "topics" ("id", "slug", "title", "description", "query", "created_at", "updated_at")
VALUES
  ('019a1a00-0000-7000-8000-000000000005', 'notes', 'Notes', 'Short posts, shared as they are.', 'kind:note', '2026-10-12T13:00:00.000Z', '2026-10-12T13:00:00.000Z'),
  ('019a1a00-0000-7000-8000-000000000006', 'til', 'TIL', 'Things I learned, one at a time.', 'kind:til', '2026-10-12T13:00:00.000Z', '2026-10-12T13:00:00.000Z');
