ALTER TABLE `clients` ADD `frontchannel_logout_uri` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `frontchannel_logout_session_required` text DEFAULT 'false';