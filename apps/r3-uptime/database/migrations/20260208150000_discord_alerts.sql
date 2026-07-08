-- Discord Alert Integration
-- No schema changes required as alert config is stored as JSON in the `config` column.
-- This migration documents the addition of Discord webhook support.
-- 
-- New config format for Discord alerts:
-- { "strategy": "discord", "config": { "webhookUrl": "https://discord.com/api/webhooks/..." } }
--
-- Added Discord option to alert strategies alongside email, webhook, and slack.

SELECT 1; -- No-op migration for documentation purposes
