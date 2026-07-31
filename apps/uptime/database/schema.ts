/**
 * Database schema for the uptime app defined with remix/data-table. Declares every
 * table backing the uptime monitoring product — teams/access, HTTP/DNS/TCP/SSL/cron-job
 * monitoring, alerts, maintenance windows, status pages, API keys, and daily stats
 * aggregation. This reuses the frozen production D1 database (see `database/migrations/`,
 * copied unchanged from the prior app), so column names and nullability mirror that
 * physical schema exactly. Audit timestamps are declared as `c.integer()` (milliseconds
 * since epoch), not text, because the existing rows already store epoch-ms integers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, ColumnBuilder, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Payload shape accepted when creating or updating a row, DB defaults included. */
type InsertRow<sourceTable extends AnyTable> = Partial<TableRow<sourceTable>>;

// Teams & access

export const teams = table({
	name: "teams",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		owner_id: c.text(),
		name: c.text(),
		slug: c.text(),
		logo: c.text().nullable(),
	},
});

export type SelectTeam = TableRow<typeof teams>;
export type InsertTeam = InsertRow<typeof teams>;

export const memberships = table({
	name: "memberships",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		subject_id: c.text(),
		team_id: c.text(),
		role: c.enum(["member", "admin"]).default("member"),
	},
});

export type SelectMembership = TableRow<typeof memberships>;
export type InsertMembership = InsertRow<typeof memberships>;

export const invites = table({
	name: "invites",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		accepted_at: c.integer().nullable(),
		sender_id: c.text(),
		team_id: c.text(),
		email: c.text(),
	},
});

export type SelectInvite = TableRow<typeof invites>;
export type InsertInvite = InsertRow<typeof invites>;

export const teamDomains = table({
	name: "team_domains",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		verified_at: c.integer().nullable(),
		team_id: c.text(),
		hostname: c.text(),
	},
});

export type SelectTeamDomain = TableRow<typeof teamDomains>;
export type InsertTeamDomain = InsertRow<typeof teamDomains>;

export const apiKeyScopes = [
	"teams:read",
	"teams:write",
	"invites:read",
	"invites:write",
	"team-domains:read",
	"team-domains:write",
	"monitors:read",
	"monitors:write",
	"maintenance:read",
	"maintenance:write",
	"dns-monitors:read",
	"dns-monitors:write",
	// Every API v1 TCP-monitor endpoint checks for these two scope strings, so they
	// must be real, grantable scopes — without them no API key could ever carry
	// TCP-monitor access and those endpoints would be permanently unreachable.
	"tcp-monitors:read",
	"tcp-monitors:write",
	"alerts:read",
	"alerts:write",
	"status-pages:read",
	"status-pages:write",
	"cron-jobs:read",
	"cron-jobs:write",
	"cron-jobs:ping",
	"api-keys:read",
	"api-keys:write",
] as const;

export type ApiKeyScope = (typeof apiKeyScopes)[number];

export const apiKeys = table({
	name: "api_keys",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		last_used_at: c.integer().nullable(),
		expires_at: c.integer().nullable(),
		team_id: c.text(),
		name: c.text(),
		key_hash: c.text(),
		key_prefix: c.text(),
		scopes: c.json() as ColumnBuilder<Array<ApiKeyScope>>,
	},
});

export type SelectApiKey = TableRow<typeof apiKeys>;
export type InsertApiKey = InsertRow<typeof apiKeys>;

export const supportedLanguages = ["en", "es", "de", "ja", "fr", "it"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const userPreferences = table({
	name: "user_preferences",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		subject_id: c.text().unique(),
		preferred_language: c.enum(supportedLanguages).nullable(),
	},
});

export type SelectUserPreferences = TableRow<typeof userPreferences>;
export type InsertUserPreferences = InsertRow<typeof userPreferences>;

// HTTP monitors

export const monitors = table({
	name: "monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		enabled_at: c.integer().nullable(),
		/**
		 * When this monitor's next check is due, or `null` when it isn't scheduled at all
		 * (disabled, or never enabled). The scheduler claims monitors by advancing this
		 * from its own previous value by whole intervals, which is what keeps the cadence
		 * anchored to the schedule rather than to each check's completion time.
		 */
		next_due_at: c.integer().nullable(),
		team_id: c.text(),
		author_id: c.text(),
		name: c.text(),
		url: c.text(),
		method: c.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("HEAD"),
		expected_status: c.integer().default(200),
		interval_seconds: c.integer().default(60),
		degraded_after_ms: c.integer().default(5000),
		timeout_seconds: c.integer().default(10),
		location_hint: c
			.enum(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"])
			.default("wnam"),
		ssl_monitoring_enabled: c.boolean().default(false),
		ssl_expiry_warning_days: c.integer().default(30),
		ssl_expires_at: c.integer().nullable(),
		ssl_issuer: c.text().nullable(),
		ssl_last_checked_at: c.integer().nullable(),
		ssl_status: c
			.enum(["unknown", "valid", "expiring", "expired", "error"])
			.nullable()
			.default("unknown"),
	},
});

export type SelectMonitor = TableRow<typeof monitors>;
export type InsertMonitor = InsertRow<typeof monitors>;

export const monitorResults = table({
	name: "monitor_results",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		completed_at: c.integer().nullable(),
		monitor_id: c.text(),
		response_status: c.integer().nullable(),
		response_time_ms: c.integer().nullable(),
	},
});

export type SelectMonitorResult = TableRow<typeof monitorResults>;
export type InsertMonitorResult = InsertRow<typeof monitorResults>;

export const monitorContentChecks = table({
	name: "monitor_content_checks",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		monitor_id: c.text(),
		type: c.enum(["contains", "not_contains", "regex"]),
		value: c.text(),
		case_sensitive: c.boolean().default(false),
		is_enabled: c.boolean().default(true),
	},
});

export type SelectMonitorContentCheck = TableRow<typeof monitorContentChecks>;
export type InsertMonitorContentCheck = InsertRow<typeof monitorContentChecks>;

// DNS monitors

export const dnsMonitors = table({
	name: "dns_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		domain: c.text(),
		record_type: c.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]),
		expected_value: c.text().nullable(),
		interval_seconds: c.integer().default(3600),
		is_enabled: c.boolean().default(true),
		last_checked_at: c.integer().nullable(),
		last_status: c.enum(["ok", "changed", "error"]).nullable(),
		last_value: c.text().nullable(),
	},
});

export type SelectDnsMonitor = TableRow<typeof dnsMonitors>;
export type InsertDnsMonitor = InsertRow<typeof dnsMonitors>;

export const dnsMonitorResults = table({
	name: "dns_monitor_results",
	columns: {
		id: c.text().primaryKey(),
		dns_monitor_id: c.text(),
		status: c.enum(["ok", "changed", "error"]),
		resolved_value: c.text().nullable(),
		response_time_ms: c.integer().nullable(),
		error_message: c.text().nullable(),
		checked_at: c.integer(),
	},
});

export type SelectDnsMonitorResult = TableRow<typeof dnsMonitorResults>;
export type InsertDnsMonitorResult = InsertRow<typeof dnsMonitorResults>;

// TCP monitors

export const tcpMonitors = table({
	name: "tcp_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		host: c.text(),
		port: c.integer(),
		timeout_ms: c.integer().default(5000),
		interval_seconds: c.integer().default(60),
		is_enabled: c.boolean().default(true),
		last_checked_at: c.integer().nullable(),
		last_status: c.enum(["up", "down", "timeout"]).nullable(),
		last_response_time_ms: c.integer().nullable(),
	},
});

export type SelectTcpMonitor = TableRow<typeof tcpMonitors>;
export type InsertTcpMonitor = InsertRow<typeof tcpMonitors>;

export const tcpMonitorResults = table({
	name: "tcp_monitor_results",
	columns: {
		id: c.text().primaryKey(),
		tcp_monitor_id: c.text(),
		status: c.enum(["up", "down", "timeout"]),
		response_time_ms: c.integer().nullable(),
		error_message: c.text().nullable(),
		checked_at: c.integer(),
	},
});

export type SelectTcpMonitorResult = TableRow<typeof tcpMonitorResults>;
export type InsertTcpMonitorResult = InsertRow<typeof tcpMonitorResults>;

// SSL monitors (standalone, separate from HTTP monitors)

export const sslMonitors = table({
	name: "ssl_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		enabled_at: c.integer().nullable(), // null = disabled
		team_id: c.text(),
		http_monitor_id: c.text().nullable(),
		name: c.text(),
		hostname: c.text(),
		port: c.integer().default(443),
		expiry_warning_days: c.integer().default(30),
		expires_at: c.integer().nullable(),
		issuer: c.text().nullable(),
		last_checked_at: c.integer().nullable(),
		status: c
			.enum(["unknown", "valid", "expiring", "expired", "error"])
			.nullable()
			.default("unknown"),
	},
});

export type SelectSslMonitor = TableRow<typeof sslMonitors>;
export type InsertSslMonitor = InsertRow<typeof sslMonitors>;

// Cron job monitors

export const cronJobStatuses = ["healthy", "late", "missed", "new"] as const;

export type CronJobStatus = (typeof cronJobStatuses)[number];

export const cronJobMonitors = table({
	name: "cron_job_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		description: c.text().nullable(),
		cron_expression: c.text(),
		grace_period_seconds: c.integer().default(300),
		timezone: c.text().default("UTC"),
		status: c.enum(cronJobStatuses).default("new"),
		alert_on_late: c.boolean().default(false),
		last_ping_at: c.integer().nullable(),
		next_expected_at: c.integer().nullable(),
		enabled_at: c.integer().nullable(),
	},
});

export type SelectCronJobMonitor = TableRow<typeof cronJobMonitors>;
export type InsertCronJobMonitor = InsertRow<typeof cronJobMonitors>;

export const cronJobPings = table({
	name: "cron_job_pings",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		cron_job_monitor_id: c.text(),
		was_on_time: c.boolean(),
		source_ip: c.text().nullable(),
		user_agent: c.text().nullable(),
	},
});

export type SelectCronJobPing = TableRow<typeof cronJobPings>;
export type InsertCronJobPing = InsertRow<typeof cronJobPings>;

// Alerts

export type AlertConfig =
	| { strategy: "webhook"; config: { url: string; secret: string } }
	| { strategy: "email"; config: { to: string; subjectPrefix: string } }
	| { strategy: "slack"; config: { webhookUrl: string; channel?: string } }
	| { strategy: "discord"; config: { webhookUrl: string } };

export const alerts = table({
	name: "alerts",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		monitor_id: c.text().nullable(),
		name: c.text(),
		notify_on_recovery: c.boolean().default(true),
		cooldown_minutes: c.integer().default(0), // 0 = no cooldown
		config: c.json() as ColumnBuilder<AlertConfig>,
	},
});

export type SelectAlert = TableRow<typeof alerts>;
export type InsertAlert = InsertRow<typeof alerts>;

export type AlertEventSnapshot =
	| {
			type: "http";
			responseStatus: number;
			responseTimeMs: number;
			expectedStatus: number;
			url: string;
	  }
	| {
			type: "dns";
			status: string;
			resolvedValue: string | null;
			domain: string;
			recordType: string;
	  }
	| { type: "tcp"; status: string; responseTimeMs: number | null; host: string; port: number }
	| {
			type: "cron";
			status: string;
			lastPingAt: string | null;
			nextExpectedAt: string | null;
			cronExpression: string;
			timezone: string;
	  }
	| {
			type: "ssl";
			status: string;
			expiresAt: string | null;
			daysUntilExpiry: number | null;
			hostname: string;
	  };

export const alertEvents = table({
	name: "alert_events",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		sent_at: c.integer(),
		alert_id: c.text(),
		monitor_id: c.text(),
		event_type: c.enum(["down", "up", "degraded"]),
		status: c.enum(["sent", "skipped_cooldown", "failed"]),
		error_message: c.text().nullable(),
		monitor_type: c.enum(["http", "dns", "tcp", "cron", "ssl"]).nullable(),
		monitor_name: c.text().nullable(),
		snapshot: (c.json() as ColumnBuilder<AlertEventSnapshot>).nullable(),
	},
});

export type SelectAlertEvent = TableRow<typeof alertEvents>;
export type InsertAlertEvent = InsertRow<typeof alertEvents>;

// Maintenance windows

export const maintenanceWindows = table({
	name: "maintenance_windows",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		monitor_id: c.text().nullable(), // null means all monitors
		name: c.text(),
		starts_at: c.integer(),
		ends_at: c.integer(),
		ended_early_at: c.integer().nullable(), // manual early termination
		suppress_alerts: c.boolean().default(true),
		show_on_status_page: c.boolean().default(true),
		is_recurring: c.boolean().default(false),
		recurring_pattern: c.text().nullable(), // e.g. "weekly:monday:02:00-04:00"
	},
});

export type SelectMaintenanceWindow = TableRow<typeof maintenanceWindows>;
export type InsertMaintenanceWindow = InsertRow<typeof maintenanceWindows>;

// Status pages

export const statusPages = table({
	name: "status_pages",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		slug: c.text().unique(),
		title: c.text(),
		description: c.text().nullable(),
		logo_url: c.text().nullable(),
		custom_domain: c.text().nullable(),
		is_public: c.boolean().default(true),
		show_overall_status: c.boolean().default(true),
	},
});

export type SelectStatusPage = TableRow<typeof statusPages>;
export type InsertStatusPage = InsertRow<typeof statusPages>;

// Physical table has no `id`/timestamp columns or an enforced unique constraint, but
// the framework requires at least one primary-key column — the pair is the natural key.
export const statusPageMonitors = table({
	name: "status_page_monitors",
	primaryKey: ["status_page_id", "monitor_id"],
	columns: {
		status_page_id: c.text(),
		monitor_id: c.text(),
		display_name: c.text().nullable(),
		order: c.integer().default(0),
	},
});

export type SelectStatusPageMonitor = TableRow<typeof statusPageMonitors>;
export type InsertStatusPageMonitor = InsertRow<typeof statusPageMonitors>;

// Physical table has no `id`/timestamp columns or an enforced unique constraint, but
// the framework requires at least one primary-key column — the pair is the natural key.
export const statusPageCronJobs = table({
	name: "status_page_cron_jobs",
	primaryKey: ["status_page_id", "cron_job_monitor_id"],
	columns: {
		status_page_id: c.text(),
		cron_job_monitor_id: c.text(),
		display_name: c.text().nullable(),
		order: c.integer().default(0),
	},
});

export type SelectStatusPageCronJob = TableRow<typeof statusPageCronJobs>;
export type InsertStatusPageCronJob = InsertRow<typeof statusPageCronJobs>;

export const statusPageDnsMonitors = table({
	name: "status_page_dns_monitors",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		status_page_id: c.text(),
		dns_monitor_id: c.text(),
		display_name: c.text().nullable(),
		order: c.integer().default(0),
	},
});

export type SelectStatusPageDnsMonitor = TableRow<typeof statusPageDnsMonitors>;
export type InsertStatusPageDnsMonitor = InsertRow<typeof statusPageDnsMonitors>;

export const statusPageTcpMonitors = table({
	name: "status_page_tcp_monitors",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		status_page_id: c.text(),
		tcp_monitor_id: c.text(),
		display_name: c.text().nullable(),
		order: c.integer().default(0),
	},
});

export type SelectStatusPageTcpMonitor = TableRow<typeof statusPageTcpMonitors>;
export type InsertStatusPageTcpMonitor = InsertRow<typeof statusPageTcpMonitors>;

export const statusPageSslMonitors = table({
	name: "status_page_ssl_monitors",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		status_page_id: c.text(),
		ssl_monitor_id: c.text(),
		display_name: c.text().nullable(),
		order: c.integer().default(0),
	},
});

export type SelectStatusPageSslMonitor = TableRow<typeof statusPageSslMonitors>;
export type InsertStatusPageSslMonitor = InsertRow<typeof statusPageSslMonitors>;

// Analytics

export const monitorDailyStats = table({
	name: "monitor_daily_stats",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		monitor_id: c.text(),
		monitor_type: c.enum(["http", "dns", "tcp", "cron"]),
		date: c.text(), // "2026-02-14" format
		total_checks: c.integer(),
		successful_checks: c.integer(),
		failed_checks: c.integer(),
		avg_response_time_ms: c.integer().nullable(),
		max_response_time_ms: c.integer().nullable(),
		p95_response_time_ms: c.integer().nullable(),
		status: c.enum(["up", "degraded", "down"]),
	},
});

export type SelectMonitorDailyStats = TableRow<typeof monitorDailyStats>;
export type InsertMonitorDailyStats = InsertRow<typeof monitorDailyStats>;
