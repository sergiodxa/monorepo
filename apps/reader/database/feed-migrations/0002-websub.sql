-- The WebSub subscription one feed holds, kept beside the feed's own row because it is
-- a fact about that feed: the hub its document currently advertises, the subscription
-- made against it, and the two counters that say whether the subscription is working.
--
-- Everything here is nullable or defaulted, so a feed with no hub — which is most of
-- them — costs the row nothing but the columns.

ALTER TABLE feed ADD COLUMN hub_url TEXT;

-- The string the subscription was made with, which is the feed's declared rel=self. It
-- is kept apart from feed_url because a hub keys its subscription by this exact text
-- while feed_url stays the address this app fetches and identifies the feed by.
ALTER TABLE feed ADD COLUMN hub_topic TEXT;

-- One of 'none', 'pending', 'active' or 'failed'. A firing alarm reads it rather than a
-- flag saying what the firing is for, so no path can leave an intent behind.
ALTER TABLE feed ADD COLUMN hub_state TEXT NOT NULL DEFAULT 'none';

-- Sent to the hub at subscription and used to verify every notification's signature, so
-- an unsigned delivery to a public URL is always a refusal.
ALTER TABLE feed ADD COLUMN hub_secret TEXT;

-- The unguessable half of the callback URL, minted per feed and re-minted on every
-- re-subscription. Stored rather than derived so one feed rotates by writing one row.
ALTER TABLE feed ADD COLUMN hub_token TEXT;

-- When the state stops being binding: for 'active' the lease as the hub reported it,
-- and for 'failed' the instant a hub may be tried again. There is no renewal column
-- beside it, since a renewal moment is this value minus a share of the lease and a
-- column that can disagree with what it derives from eventually will.
ALTER TABLE feed ADD COLUMN hub_lease_until INTEGER;

-- The last accepted notification, and how many have been accepted since the day it
-- opened. Together they judge a flood: a hub delivering more in a day than the feed
-- could possibly publish costs more than polling it.
ALTER TABLE feed ADD COLUMN hub_notified_at INTEGER;
ALTER TABLE feed ADD COLUMN hub_notifications INTEGER NOT NULL DEFAULT 0;

-- Polls that found items no notification announced. A hub that verifies happily and
-- then delivers nothing is the commonest way this is quietly not working, and the
-- fallback poll is the only thing that can see it.
ALTER TABLE feed ADD COLUMN hub_misses INTEGER NOT NULL DEFAULT 0;
