ALTER TABLE `clients` ADD `backchannel_logout_uri` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `backchannel_logout_session_required` text DEFAULT 'false';