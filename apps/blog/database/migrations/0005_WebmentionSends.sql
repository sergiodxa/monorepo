-- Migration number: 0005 	 2026-09-26T01:00:00.000Z

-- Every target a post has notified, so an update or a delete can notify the links the
-- post no longer carries. A row is removed once its target is told the link is gone.
CREATE TABLE webmention_sends (
  id VARCHAR(36) UNIQUE PRIMARY KEY,
  -- Attributes
  target VARCHAR(2048) NOT NULL,
  status VARCHAR(16) NOT NULL,
  endpoint VARCHAR(2048),
  code INTEGER,
  location VARCHAR(2048),
  -- Relations
  post_id VARCHAR(36) NOT NULL,
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Constraints
  CONSTRAINT fk_webmention_sends_post_id FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_webmention_sends_post_id_target ON webmention_sends (post_id, target);

-- When a post last sent its Webmentions. The scheduled-post cron sends for every post
-- whose publish date has arrived since then; NULL means it never sent.
ALTER TABLE posts ADD COLUMN mentions_sent_at TIMESTAMP;

-- Posts that exist before sending ships count as sent, so the first cron run notifies
-- only posts scheduled to publish after this migration, not the whole archive.
UPDATE posts SET mentions_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
