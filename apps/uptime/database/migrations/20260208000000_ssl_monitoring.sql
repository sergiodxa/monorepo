-- Add SSL monitoring fields to monitors table
ALTER TABLE `monitors` ADD `ssl_monitoring_enabled` integer DEFAULT 0 NOT NULL;
ALTER TABLE `monitors` ADD `ssl_expiry_warning_days` integer DEFAULT 30 NOT NULL;
ALTER TABLE `monitors` ADD `ssl_expires_at` integer;
ALTER TABLE `monitors` ADD `ssl_issuer` text;
ALTER TABLE `monitors` ADD `ssl_last_checked_at` integer;
ALTER TABLE `monitors` ADD `ssl_status` text DEFAULT 'unknown';
