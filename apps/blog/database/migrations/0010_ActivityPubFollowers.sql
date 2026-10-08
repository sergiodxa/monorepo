-- Migration number: 0010 	 2026-10-07T20:00:00.000Z

-- Remote actors following the blog's ActivityPub actor, one row per (local actor, remote
-- actor): a repeated Follow replaces the row, refreshing its inboxes and Follow id. Only
-- 'accepted' rows are listed, counted and delivered to; 'pending' waits for approval.
CREATE TABLE "activitypub_followers" (
  "actor" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "inbox" TEXT NOT NULL,
  "shared_inbox" TEXT,
  "follow_id" TEXT NOT NULL,
  "state" TEXT NOT NULL CHECK ("state" IN ('accepted', 'pending')),
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  PRIMARY KEY ("actor", "id")
);

-- The followers collection and the delivery fan-out read one actor's accepted rows.
CREATE INDEX "activitypub_followers_actor_state" ON "activitypub_followers" ("actor", "state", "created_at");

-- An inbox answering 410 drops every follower reached through it, personal or shared.
CREATE INDEX "activitypub_followers_inbox" ON "activitypub_followers" ("inbox");
CREATE INDEX "activitypub_followers_shared_inbox" ON "activitypub_followers" ("shared_inbox");
