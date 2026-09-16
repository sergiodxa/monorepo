-- The devices a reader is reached on, the per-subscription answer about which publishers
-- are worth reaching them about, and the single timestamp every batching rule is derived
-- from.
--
-- Added rather than rebuilt: nothing here renames or retypes a column. Every new answer
-- defaults to the quietest one it has, so migrating an object opts nobody into anything.

-- One browser the reader asked to be reached on. `endpoint` is the URL the push service
-- gave that browser, and `p256dh` and `auth` are the public key and auth secret the
-- payload is encrypted under, exactly as the Push API handed them over.
--
-- `locale` is the language that browser was reading the app in when it registered, which
-- is what the notification's own sentence is written in: an alarm carries no request, so
-- there is no header left to detect one from at the moment of sending.
--
-- `failure_count` covers transient refusals only. Any acceptance clears it, and ten
-- consecutive failures delete the row, because an endpoint refusing across ten checks is
-- not coming back.
CREATE TABLE push_subscriptions (
	id TEXT PRIMARY KEY,
	endpoint TEXT NOT NULL,
	p256dh TEXT NOT NULL,
	auth TEXT NOT NULL,
	user_agent TEXT,
	locale TEXT NOT NULL DEFAULT 'en',
	last_delivered_at INTEGER,
	failure_count INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- One row per endpoint, which is what makes registration idempotent: a browser that
-- re-subscribes hands back the endpoint it already had, so a reader signing in twice on
-- one device keeps one row and receives one notification.
CREATE UNIQUE INDEX push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);

-- Whether this reader wants to hear about this publisher. It sits beside `velocity` for
-- the reason `velocity` is there: it is this reader's answer about this publisher, and two
-- readers of one newspaper disagree about it. Off, so following a feed, importing two
-- hundred from OPML and changing plan each leave every subscription silent.
ALTER TABLE feeds ADD COLUMN notify INTEGER NOT NULL DEFAULT 0;

-- How a notified feed reaches the reader, which is an account-level answer rather than a
-- per-feed one: the alternative is a grid of feeds by channels that nobody fills in.
ALTER TABLE settings ADD COLUMN notify_push INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 0;

-- The window the reader is left alone in, in their own hours, applied only once they turn
-- it on. The zone is an IANA name rather than an offset, so daylight saving is the
-- platform's problem instead of arithmetic that is wrong twice a year, and it holds UTC
-- until a browser has said otherwise.
ALTER TABLE settings ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE settings ADD COLUMN quiet_hours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN quiet_from INTEGER NOT NULL DEFAULT 22;
ALTER TABLE settings ADD COLUMN quiet_to INTEGER NOT NULL DEFAULT 7;

-- The whole of the notification state. The summary, the minimum gap and a retry after a
-- failed send are all derived from this one number, which is what makes a suppression a
-- deferral by construction: a notification that does not go out leaves it where it was,
-- and the next one carries everything since.
ALTER TABLE settings ADD COLUMN last_notified_at INTEGER;

-- Where the email channel sends. It is written on every completed sign-in, which is
-- idempotent already and therefore picks up a changed address for free, and it is never a
-- key: an object is addressed by subject, because an address can be reassigned.
ALTER TABLE settings ADD COLUMN email TEXT;

-- The summary counts the posts this object wrote since the last notification, gathered by
-- the subscription they came from. Leading with the column the count is taken over lets
-- that read walk a range of the index rather than every post the reader holds.
CREATE INDEX feed_items_materialized_idx ON feed_items (created_at, feed_id);
