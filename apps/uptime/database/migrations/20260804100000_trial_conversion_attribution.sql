-- Where a converted account first arrived from, on the one trial table nothing sweeps.
--
-- `trial_daily_stats` can already say how many leads, watches, sign-ups and payments a day
-- produced. What it cannot say is which page or campaign produced any of them, because every
-- counter it holds is incremented *after* somebody has already decided to hand over an
-- address. First touch is only knowable while a visitor is still anonymous, and the sign-in
-- that finally identifies them can be days later — so it is carried in the session and copied
-- here at sign-in, alongside the other facts this row copies for the same reason.
--
-- All three are nullable and will be null for most existing rows. Attribution rides in a
-- session cookie, so a visitor who blocks it or arrives in a fresh session has none, and every
-- row written before this migration has none either. A missing value has to read as "unknown"
-- rather than as "direct": the second is a claim, and it would quietly credit every blocked
-- cookie to the homepage.
--
-- Deliberately three short slugs and a path. This row is the one thing about a lead that
-- outlives their unsubscribe, so it may never carry a query string, a referrer, an address, or
-- anything the person typed — see `app/http/middleware/attribution.ts` for the normalization
-- that enforces it on the way in.
--
-- No index. These columns are read by the daily funnel report, which already scans a bounded
-- date range off `trial_conversions_signed_up_at_idx` and groups in memory; an index on a
-- low-cardinality nullable slug would earn nothing and cost every write.

ALTER TABLE `trial_conversions` ADD COLUMN `landing_path` text;
--> statement-breakpoint
ALTER TABLE `trial_conversions` ADD COLUMN `campaign_source` text;
--> statement-breakpoint
ALTER TABLE `trial_conversions` ADD COLUMN `campaign_name` text;
