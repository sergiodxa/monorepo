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
	// Named for what the holder does rather than for what the server writes: a key with
	// this scope triggers one-shot checks through `POST /api/v1/ping`, and there is no
	// stored ping resource for a `:read`/`:write` pair to describe. Appended rather than
	// inserted in place — the column stores the strings, so position means nothing, but
	// the checkbox list on the API-key form is rendered in this order.
	"ping:trigger",
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

/**
 * What a completed HTTP check classifies a monitor as — the value set of
 * `monitors.last_status`, and what the check pipeline passes around. Declared here, next
 * to the column, so adding a status is one edit rather than one per repeated union.
 */
export const monitorStatuses = ["up", "down", "degraded"] as const;

export type MonitorStatus = (typeof monitorStatuses)[number];

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
		/**
		 * What the last completed check classified this monitor as, when it completed, and
		 * how long it took. A **cache**, written by the consumer after the result is
		 * committed: the Analytics Engine result stream stays authoritative for history and
		 * aggregation, and these exist only so transition detection and the list row cost no
		 * query. When the two disagree, believe the stream — the same relationship
		 * `dns_monitors.last_value` has with `dns_monitor_results`, and the same trio
		 * `tcp_monitors` already carries. `NULL` means "never checked", which recovery
		 * detection reads as not-a-recovery, so no backfill is needed.
		 */
		last_status: c.enum(monitorStatuses).nullable(),
		last_checked_at: c.integer().nullable(),
		last_response_time_ms: c.integer().nullable(),
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
		/**
		 * When this monitor's next check is due, or `null` when it isn't scheduled at all.
		 * The sweep claims monitors by advancing this from its own previous value by whole
		 * intervals, which is what makes `interval_seconds` authoritative instead of the
		 * sweep's own cadence (ADR-006). Same column, same meaning, on all three monitor
		 * tables.
		 */
		next_due_at: c.integer().nullable(),
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
		/** When this monitor's next check is due, or `null` when it isn't scheduled at all — see `dns_monitors.next_due_at`. */
		next_due_at: c.integer().nullable(),
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
		// 0 is still legal (notify on every check) but is no longer the default: an
		// unthrottled alert on a 1-minute monitor is one email per minute for as long as
		// the outage lasts (ADR-004).
		cooldown_minutes: c.integer().default(15),
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

/**
 * What became of one alert delivery attempt. Declared here, next to the column, so the
 * value set is a real union rather than `string` — the alert pipeline and the history view
 * both branch on it. Every reason an alert was recorded without being delivered is named
 * `skipped_*`, which is what lets both of them treat suppressions as a group.
 */
export const alertEventStatuses = ["sent", "skipped_cooldown", "skipped_cap", "failed"] as const;

export type AlertEventStatus = (typeof alertEventStatuses)[number];

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
		status: c.enum(alertEventStatuses),
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

// Billing

/**
 * A **projection** of Polar's subscription state, written only by the Polar webhook and
 * the daily reconciliation sweep (ADR-005). Polar stays authoritative for money; these
 * rows exist so authorisation costs one indexed read instead of one API call, which is
 * what lets the every-minute scheduler ask nothing at all.
 *
 * Nothing else may write here, and a drift between this table and Polar is never fixed by
 * editing a row: reconciliation reads Polar and repairs the projection in the one
 * direction that keeps the two convergent. Rows are kept after a subscription ends —
 * `status` records how it ended, and the absence of any row for a customer is what
 * "we have never learned anything about them" means (see `Subscription.stateFor`).
 */
export const subscriptions = table({
	name: "subscriptions",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/**
		 * The OIDC subject the Polar customer is linked to by `Customer.findOrCreate`, which
		 * equals `teams.owner_id` — so authorisation needs no join hop from a team to its
		 * billing identity.
		 */
		external_customer_id: c.text(),
		polar_subscription_id: c.text(),
		polar_product_id: c.text(),
		/** Polar's own status string, not an app enum — see `isActiveSubscriptionStatus`. */
		status: c.text(),
		current_period_end: c.integer().nullable(),
		revoked_at: c.integer().nullable(),
		/**
		 * When Polar last modified the subscription, from the payload itself. This is the
		 * version stamp the upsert orders events by: Polar retries deliveries and events can
		 * arrive out of order, and `updated_at` above is when *this app* wrote the row, which
		 * is always later than the payload and so can't order two payloads against each
		 * other.
		 */
		polar_modified_at: c.integer(),
	},
});

export type SelectSubscription = TableRow<typeof subscriptions>;
export type InsertSubscription = InsertRow<typeof subscriptions>;

// Trial watches

/**
 * Someone who probed a target on the public trial page and left an email so the result
 * could be followed up on. Not a user and not a Polar customer: nothing here is billed and
 * no customer is provisioned, because a lead only becomes one by actually signing up.
 *
 * Identity, consent, and one schedule. Everything tied to a *particular attempt* — how long
 * that target is checked for, how long a sign-up can still claim it, whether it was claimed
 * — belongs on {@link trialWatches}, because one person can try three URLs on three
 * different days and each attempt runs its own clocks.
 *
 * The one schedule that is per person is the daily digest, and `last_digest_at` is here for
 * that reason: someone watching three URLs gets one email a day covering all three, not
 * three emails. The full split, which is the thing a future reader will assume is an
 * accident:
 *
 * | Schedule            | Lives on        | Why                                          |
 * | ------------------- | --------------- | -------------------------------------------- |
 * | hourly check        | `trial_watches` | one target is checked, not one person        |
 * | on-change email     | `trial_watches` | it is about one target going down            |
 * | **daily digest**    | **`leads`**     | one reader, one inbox, one email a day       |
 * | weekly wrap-up      | `trial_watches` | it ends *that* watch's seven days            |
 *
 * Two different deletions reach this row and they must not be confused. `Lead.deleteOrphaned`
 * is the scheduled sweep and is conditional — it only removes a lead once no watch is left
 * to protect. `Lead.forget` is the unsubscribe cascade and is unconditional: it takes the
 * lead, its watches and their results, open conversion windows included.
 */
export const leads = table({
	name: "leads",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/**
		 * Unique, and deliberately the natural key rather than a surrogate one: the address is
		 * the only identifier an anonymous visitor gives us, and it is also what the sign-in
		 * path has in hand when it looks for trial targets to convert. A second row for the
		 * same address would split one person's watches across two leads and send them two
		 * digests a day, so the constraint is in the database and not only in
		 * `Lead.upsertByEmail`.
		 */
		email: c.text().unique(),
		/**
		 * The random, unguessable token every trial email's unsubscribe link carries.
		 *
		 * This is the only credential a lead will ever hold — they never made an account, so
		 * there is nothing to sign in with and nothing else to prove the request is theirs.
		 * Random and never derived from the address for exactly that reason: anything
		 * computable from a known email would let a stranger unsubscribe anyone whose address
		 * they can guess. Unique and indexed because it is looked up on its own.
		 */
		unsubscribe_token: c.text().unique(),
		/** Optional because the form asks for a first name and does not require one. */
		/** Which language every follow-up email goes out in, taken from the page they used. */
		locale: c.enum(supportedLanguages),
		/**
		 * When they ticked the marketing opt-in, or `null` when they never did.
		 *
		 * `null` is load-bearing and is not the same as "no lead": handing over an email to be
		 * told about *this target* is not consent to be emailed about anything else. The
		 * digest and wrap-up emails are the service they asked for and go out either way;
		 * every other send must read this column first, and a null here forbids it.
		 *
		 * It does not extend the row's life. Every email this feature sends is driven by a
		 * watch, so once a lead's last watch is gone there is nothing for the consent to
		 * authorise and `Lead.deleteOrphaned` takes the row regardless of this column — see
		 * that method for when adding a standing mailing list would change the answer.
		 */
		consented_at: c.integer().nullable(),
		/**
		 * When the last daily digest went out — the one schedule that belongs to the person
		 * rather than to a target. See `shouldSendDigest` for the once-per-day bound this
		 * enforces and `Lead.listDueForDigest` for the query it drives.
		 */
		last_digest_at: c.integer().nullable(),
	},
});

export type SelectLead = TableRow<typeof leads>;
export type InsertLead = InsertRow<typeof leads>;

/**
 * One URL from the public trial page, re-checked hourly for seven days.
 *
 * HTTP only, which is why there is no type column: the public page probes a URL and nothing
 * else. The authenticated ping API still offers HTTP, DNS and TCP; adding one of those to
 * the free page would be a migration then rather than an unused column now.
 *
 * Two independent deadlines sit on this row and neither implies the other:
 *
 * - `expires_at` (`created_at` + 7 days) ends the **checking**. The hourly checks stop, the
 *   weekly wrap-up goes out, `next_due_at` goes null.
 * - `converts_until` (`created_at` + 30 days) ends the **offer**. Until then, signing up
 *   turns this target into a real monitor.
 *
 * They are per watch and not per lead because each attempt is its own offer: someone who
 * tries URL A on day 0 and URL B on day 3 and signs up on day 32 gets a monitor for B and
 * not for A. A lead-level window could not express that.
 *
 * Nothing may delete this row while `converts_until` is in the future — the URL on it is the
 * only record of what a conversion should create.
 */
export const trialWatches = table({
	name: "trial_watches",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		lead_id: c.text(),
		/** The URL being watched, and the one a conversion turns into a real HTTP monitor. */
		url: c.text(),
		/**
		 * Fixed at one hour by the product and not editable anywhere, but stored rather than
		 * hard-coded in the sweep because it is what makes this table claimable by the same
		 * `claimDue` statement the three monitor tables use — that statement advances
		 * `next_due_at` in terms of this column. A cadence the schema states is also one a
		 * migration can change without touching code.
		 */
		interval_seconds: c.integer().default(3600),
		/**
		 * When the next hourly check is owed, or `null` when the watch is finished.
		 *
		 * Same column, same meaning, same claim as `monitors.next_due_at`: `null` is "not
		 * scheduled", so nulling it at expiry is exactly how a finished watch leaves the
		 * sweep's claim, and one index on this column serves the whole predicate. It is also
		 * what "currently active" means to the daily digest.
		 */
		next_due_at: c.integer().nullable(),
		/** `created_at` + 7 days: when checking stops and the weekly wrap-up goes out. */
		expires_at: c.integer(),
		/**
		 * `created_at` + 30 days: when the offer to turn this target into a real monitor on
		 * sign-up runs out. Stored rather than derived so the deadline this attempt was
		 * actually given survives a change to the policy constant, and so the cleanup sweep is
		 * an indexed range over one column rather than arithmetic in a `WHERE` clause.
		 */
		converts_until: c.integer(),
		/**
		 * The previous check's status, which is the entire basis for detecting a change — the
		 * history table below is what a digest renders, but a sweep must not have to read it
		 * to answer "is this different from last hour?".
		 */
		last_status: c.enum(monitorStatuses).nullable(),
		/**
		 * Running totals a digest reads directly. Redundant with `trial_watch_results`, and
		 * worth it: the totals are wanted for every target on every digest while the history
		 * is only wanted for the bar, and keeping them here means the common read is the row
		 * the query already returned rather than an aggregate over 168 rows per target.
		 */
		checks_run: c.integer().default(0),
		checks_ok: c.integer().default(0),
		max_response_time_ms: c.integer().default(0),
		/**
		 * When the last "your target changed" email went out. Per watch, because that email is
		 * about one specific target going down or recovering, and it is the only thing
		 * bounding how many of them a flapping target can trigger — see `shouldNotifyChange`.
		 */
		change_notified_at: c.integer().nullable(),
		/**
		 * When this watch's seven-day wrap-up went out; set once, at the same time checking
		 * stops. Per watch and not per lead on purpose: watches started on different days end
		 * on different days, so a lead who tried URLs on days 0, 3 and 6 is wrapped up on days
		 * 7, 10 and 13, each email about the target whose week just ended.
		 */
		summary_sent_at: c.integer().nullable(),
		/**
		 * The real monitor this target became and when, or `null` while it is still only a
		 * trial.
		 *
		 * Per watch rather than per lead because that is the only shape that can represent a
		 * partial conversion — two targets claimed, a third already past its own
		 * `converts_until` — and because it is the exact idempotency guard: signing in a
		 * second time finds nothing unconverted and creates nothing.
		 */
		converted_monitor_id: c.text().nullable(),
		converted_at: c.integer().nullable(),
	},
});

export type SelectTrialWatch = TableRow<typeof trialWatches>;
export type InsertTrialWatch = InsertRow<typeof trialWatches>;

/**
 * One trial check, shaped like `dns_monitor_results` and `tcp_monitor_results` so it reads
 * the same way. A digest draws an uptime bar over these rows, which totals on the watch
 * cannot produce.
 *
 * This is the disposable one of the three trial tables and the only one a retention sweep
 * may delete from. Rows are bounded by construction — 168 per watch, and then the watch
 * stops writing — but bounded is not self-deleting, and they are dead the moment the
 * digests that render them have been sent. Deleting a `trial_watches` row instead would
 * lose the target a sign-up would have converted.
 */
export const trialWatchResults = table({
	name: "trial_watch_results",
	columns: {
		id: c.text().primaryKey(),
		trial_watch_id: c.text(),
		status: c.enum(monitorStatuses),
		response_time_ms: c.integer().nullable(),
		checked_at: c.integer(),
	},
});

export type SelectTrialWatchResult = TableRow<typeof trialWatchResults>;
export type InsertTrialWatchResult = InsertRow<typeof trialWatchResults>;
