-- Add notify_on_recovery field to alerts table
ALTER TABLE `alerts` ADD `notify_on_recovery` integer DEFAULT 1 NOT NULL;
