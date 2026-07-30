-- Migration: Analytics Engine Migration (ADR-001)
-- Creates tables for SSL monitors, daily stats, and status page monitor types
-- Adds enhanced context columns to alert_events

-- SSL Monitors (standalone, separate from HTTP monitors)
CREATE TABLE `ssl_monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`enabled_at` integer,
	`team_id` text NOT NULL,
	`http_monitor_id` text,
	`name` text NOT NULL,
	`hostname` text NOT NULL,
	`port` integer DEFAULT 443 NOT NULL,
	`expiry_warning_days` integer DEFAULT 30 NOT NULL,
	`expires_at` integer,
	`issuer` text,
	`last_checked_at` integer,
	`status` text DEFAULT 'unknown'
);

CREATE INDEX `ssl_monitors_team_idx` ON `ssl_monitors` (`team_id`);
CREATE INDEX `ssl_monitors_enabled_idx` ON `ssl_monitors` (`enabled_at`);

-- Monitor Daily Stats (aggregated data for 365-day retention)
CREATE TABLE `monitor_daily_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`monitor_id` text NOT NULL,
	`monitor_type` text NOT NULL,
	`date` text NOT NULL,
	`total_checks` integer NOT NULL,
	`successful_checks` integer NOT NULL,
	`failed_checks` integer NOT NULL,
	`avg_response_time_ms` integer,
	`max_response_time_ms` integer,
	`p95_response_time_ms` integer,
	`status` text NOT NULL
);

CREATE INDEX `monitor_daily_stats_monitor_type_date_idx` ON `monitor_daily_stats` (`monitor_id`, `monitor_type`, `date`);
CREATE INDEX `monitor_daily_stats_date_idx` ON `monitor_daily_stats` (`date`);

-- Status Page DNS Monitors
CREATE TABLE `status_page_dns_monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status_page_id` text NOT NULL,
	`dns_monitor_id` text NOT NULL,
	`display_name` text,
	`order` integer DEFAULT 0 NOT NULL
);

CREATE INDEX `status_page_dns_monitors_page_idx` ON `status_page_dns_monitors` (`status_page_id`);

-- Status Page TCP Monitors
CREATE TABLE `status_page_tcp_monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status_page_id` text NOT NULL,
	`tcp_monitor_id` text NOT NULL,
	`display_name` text,
	`order` integer DEFAULT 0 NOT NULL
);

CREATE INDEX `status_page_tcp_monitors_page_idx` ON `status_page_tcp_monitors` (`status_page_id`);

-- Status Page SSL Monitors
CREATE TABLE `status_page_ssl_monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status_page_id` text NOT NULL,
	`ssl_monitor_id` text NOT NULL,
	`display_name` text,
	`order` integer DEFAULT 0 NOT NULL
);

CREATE INDEX `status_page_ssl_monitors_page_idx` ON `status_page_ssl_monitors` (`status_page_id`);

-- Add enhanced context columns to alert_events (nullable for backward compatibility)
ALTER TABLE `alert_events` ADD COLUMN `monitor_type` text;
ALTER TABLE `alert_events` ADD COLUMN `monitor_name` text;
ALTER TABLE `alert_events` ADD COLUMN `snapshot` text;
