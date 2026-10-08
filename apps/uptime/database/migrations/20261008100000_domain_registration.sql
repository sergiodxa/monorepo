-- Domain registration expiry on DNS monitors (ADR-035): the registry's expiry date, status and
-- registrar, read over RDAP by the hourly `checkDomainRegistrations` sweep.
--
-- Every column is added in place. The two NOT NULL ones carry a default, so existing monitors
-- read `unknown` with a 30-day warning window and zero failures; every other column is
-- nullable, and a NULL `registration_next_check_at` makes each existing monitor due on the
-- first sweep after deploy.
--
-- No index on `registration_next_check_at`: a team holds at most 20 DNS monitors, and an
-- hourly scan of the table costs less than an index written on every lookup.
ALTER TABLE `dns_monitors` ADD COLUMN `registration_status` text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registration_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registration_epp_statuses` text;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registrar` text;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registration_warning_days` integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registration_checked_at` integer;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registration_error` text;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registration_failures` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `dns_monitors` ADD COLUMN `registration_next_check_at` integer;
