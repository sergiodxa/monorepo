-- Migration number: 0003 	 2026-02-23T00:00:00.000Z

-- Add published_at column for scheduling posts
-- NULL = published immediately (existing behavior preserved)
-- Future date = hidden until that date passes
ALTER TABLE posts ADD COLUMN published_at TIMESTAMP;

-- Create index for efficient filtering of published posts
CREATE INDEX idx_posts_published_at ON posts (published_at);
