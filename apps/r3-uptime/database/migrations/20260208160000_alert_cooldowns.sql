-- Alert Cooldowns Feature
-- Add cooldownMinutes to alerts table and create alert_events table for tracking

-- Add cooldown_minutes column to alerts table (default 0 = no cooldown)
ALTER TABLE alerts ADD COLUMN cooldown_minutes INTEGER NOT NULL DEFAULT 0;

-- Create alert_events table to track sent alerts and enable cooldown logic
CREATE TABLE alert_events (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL,
    sent_at INTEGER NOT NULL,
    alert_id TEXT NOT NULL,
    monitor_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT
);

-- Create indexes for efficient querying
CREATE INDEX alert_events_alert_id_idx ON alert_events(alert_id);
CREATE INDEX alert_events_monitor_id_idx ON alert_events(monitor_id);
CREATE INDEX alert_events_sent_at_idx ON alert_events(sent_at);
CREATE INDEX alert_events_alert_monitor_event_sent_idx ON alert_events(alert_id, monitor_id, event_type, sent_at);
