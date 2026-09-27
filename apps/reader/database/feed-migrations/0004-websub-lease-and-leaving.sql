-- What a WebSub subscription needs remembered beyond the one it currently holds.
--
-- hub_lease_seconds is the lease the hub granted, which is what a renewal is timed from:
-- a hub granting an hour renews inside that hour rather than on a schedule sized for the
-- ten days this app asks for. NULL on a subscription verified before it was recorded,
-- which renews as if the requested lease had been granted.
ALTER TABLE feed ADD COLUMN hub_lease_seconds INTEGER;

-- The callback token and topic of the subscription most recently left, so the hub's
-- verification of that unsubscription is confirmed rather than refused. Cleared once it
-- has been confirmed, and overwritten by the next subscription left.
ALTER TABLE feed ADD COLUMN hub_leaving_token TEXT;
ALTER TABLE feed ADD COLUMN hub_leaving_topic TEXT;
