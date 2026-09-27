-- Migration number: 0004 	 2026-09-26T00:00:00.000Z

-- Webmentions received for the blog's posts, one row per source/target pair: a pair
-- sent again is an update of the same mention. `status` is pending until moderated,
-- then approved or rejected; deleted once the source stops linking or answers 410.
CREATE TABLE webmentions (
  id VARCHAR(36) UNIQUE PRIMARY KEY,
  -- Attributes
  source VARCHAR(2048) NOT NULL,
  target VARCHAR(2048) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  kind VARCHAR(16) NOT NULL DEFAULT 'mention',
  url VARCHAR(2048) NOT NULL,
  author_name TEXT,
  author_url VARCHAR(2048),
  author_photo VARCHAR(2048),
  name TEXT,
  content_html TEXT,
  content_text TEXT,
  published_at TIMESTAMP,
  -- Relations
  post_id VARCHAR(36) NOT NULL,
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Constraints
  CONSTRAINT fk_webmentions_post_id FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_webmentions_source_target ON webmentions (source, target);
CREATE INDEX idx_webmentions_post_id_status ON webmentions (post_id, status);
CREATE INDEX idx_webmentions_status ON webmentions (status);

-- Moderation policy per source host: 'allow' approves a verified mention on arrival,
-- 'block' drops every request naming the host as its source.
CREATE TABLE webmention_domains (
  host VARCHAR(255) UNIQUE PRIMARY KEY,
  -- Attributes
  policy VARCHAR(16) NOT NULL,
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tombstone for deleted posts: a deleted post keeps its row and slug so its URL answers
-- 410 Gone, which is how a Webmention receiver learns the mention was withdrawn.
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP;
