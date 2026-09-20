-- The definition set release flags and kill switches read from lives in Cloudflare
-- KV, never in this database. This table is the only thing here of theirs: one row
-- per accepted write, so changing how a live identity provider behaves for every
-- tenant leaves a record independent of the value that changed.
CREATE TABLE flag_change (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  before TEXT,
  after TEXT NOT NULL,
  actor TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX flag_change_key ON flag_change (key);
