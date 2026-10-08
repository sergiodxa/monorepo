-- The VAPID public key each browser subscribed under. A push service refuses a message
-- signed by any other key, so recording it is what lets a rotated key keep signing for the
-- browsers that subscribed under it until they subscribe again.
--
-- Null for every row registered before this column existed, which delivery signs with the
-- current key: the only key those browsers can have subscribed under.
ALTER TABLE push_subscriptions ADD COLUMN vapid_key TEXT;
