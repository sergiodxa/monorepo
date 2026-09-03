/**
 * Database schema for the uptime app defined with remix/data-table. Declares every
 * table backing the uptime monitoring product — teams/access, HTTP/DNS/TCP/SSL/cron-job
 * monitoring, alerts, maintenance windows, status pages, API keys, and daily stats
 * aggregation. This reuses a frozen production D1 database (see `database/migrations/`),
 * so column names and nullability mirror that physical schema exactly. Audit timestamps
 * are declared as `c.integer()` (milliseconds since epoch), not text, because the
 * existing rows already store epoch-ms integers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, ColumnBuilder, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Payload shape accepted when creating or updating a row, DB defaults included. */
type InsertRow<sourceTable extends AnyTable> = Partial<TableRow<sourceTable>>;

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
		/**
		 * When this membership was last sent the daily and the weekly team digest, or `null`
		 * for one that never has been. Stamped per membership so one person in three teams
		 * gets three digests; written only after an accepted send, so retries are safe.
		 */
		last_daily_digest_at: c.integer().nullable(),
		last_weekly_digest_at: c.integer().nullable(),
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
	/**
	 * Real, grantable scopes: every API v1 TCP-monitor endpoint checks for these two
	 * strings, so their absence would make TCP-monitor access ungrantable and those
	 * endpoints permanently unreachable.
	 */
	"tcp-monitors:read",
	"tcp-monitors:write",
	"flow-monitors:read",
	"flow-monitors:write",
	"alerts:read",
	"alerts:write",
	"status-pages:read",
	"status-pages:write",
	"cron-jobs:read",
	"cron-jobs:write",
	"cron-jobs:ping",
	"api-keys:read",
	"api-keys:write",
	/**
	 * Named for what the holder does, not for a resource — there is no stored ping
	 * resource for a `:read`/`:write` pair to describe. Appended last because the
	 * checkbox list on the API-key form renders scopes in this order.
	 */
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

/**
 * Every email a member can turn off — the value set of `unsubscribed_emails`. Holds only
 * the *optional* mail: an invite, alert, or transactional message already answers something
 * the member did, so none of those belong in a list meant to be switched off.
 */
export const optionalEmails = ["teamDailyDigest", "teamWeeklyDigest"] as const;

export type OptionalEmail = (typeof optionalEmails)[number];

export const userPreferences = table({
	name: "user_preferences",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		subject_id: c.text().unique(),
		preferred_language: c.enum(supportedLanguages).nullable(),
		/**
		 * The {@link optionalEmails} this subject has turned off, or `null` for one who has
		 * turned nothing off. Stored as refusals, so a new digest is opt-out for everyone
		 * with no backfill, and an unknown string is ignored on read.
		 */
		unsubscribed_emails: (c.json() as ColumnBuilder<Array<OptionalEmail>>).nullable(),
	},
});

export type SelectUserPreferences = TableRow<typeof userPreferences>;
export type InsertUserPreferences = InsertRow<typeof userPreferences>;

/**
 * The queue of accounts asked to be deleted, one row per person waiting for the daily sweep.
 * The row is the retry state too: it is removed only once the whole erasure succeeds and the
 * confirmation mail is accepted, so a run that fails halfway is retried untouched tomorrow.
 */
export const accountDeletions = table({
	name: "account_deletions",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		/** The OIDC subject to erase. Unique: asking twice is one request, not two. */
		subject_id: c.text().unique(),
		/**
		 * Address the confirmation mail goes to — the one account-holder address stored
		 * anywhere in this app. Captured here because deletion erases the OIDC subject and
		 * every other trace, so this request is the only chance to have one to mail.
		 */
		email: c.text(),
		/** When the person asked, which is what the queued-state copy tells them back. */
		requested_at: c.integer(),
	},
});

export type SelectAccountDeletion = TableRow<typeof accountDeletions>;
export type InsertAccountDeletion = InsertRow<typeof accountDeletions>;

/**
 * What a completed HTTP check classifies a monitor as — the value set of
 * `monitors.last_status`, and what the check pipeline passes around. Declared here, next
 * to the column, so adding a status stays a single edit that every derived union picks up.
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
		 * (disabled, or never enabled). The scheduler advances this from its own previous
		 * value by whole intervals, keeping the cadence anchored to the schedule.
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
		 * What the last completed check classified this monitor as, when, and how long it
		 * took. Cached only so transition detection and the list row cost no query; on
		 * disagreement, the Analytics Engine result stream is what to believe.
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

export const dnsMonitors = table({
	name: "dns_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		/** The zone apex this monitor covers, absolute, lowercased, no trailing dot. */
		domain: c.text(),
		/**
		 * When a zone file was last pasted and parsed; only the timestamp persists, since a
		 * re-paste covers every use a stored copy of a customer's infrastructure map would.
		 * `null` means every tracked name came from resolution, covering just the apex.
		 */
		zone_file_imported_at: c.integer().nullable(),
		/**
		 * Daily by default: DNS changes are human-caused and human-paced, and a record's TTL
		 * already sets the floor under detection latency no matter the interval chosen.
		 */
		interval_seconds: c.integer().default(86_400),
		/**
		 * When this monitor's next check is due, or `null` when it isn't scheduled at all.
		 * The sweep advances this from its own previous value by whole intervals, so
		 * `interval_seconds` alone sets the cadence (ADR-006), same as on every monitor table.
		 */
		next_due_at: c.integer().nullable(),
		is_enabled: c.boolean().default(true),
		last_checked_at: c.integer().nullable(),
		last_status: c.enum(["ok", "changed", "error"]).nullable(),
	},
});

export type SelectDnsMonitor = TableRow<typeof dnsMonitors>;
export type InsertDnsMonitor = InsertRow<typeof dnsMonitors>;

/**
 * What the last check found for one tracked record. `new` and `missing` are properties of
 * the record itself: it stays `new` until the user enables or deletes it, and `changed`
 * marks the one case a diff can attribute without guessing.
 */
export const dnsRecordStates = ["ok", "changed", "missing", "new", "error"] as const;

export type DnsRecordState = (typeof dnsRecordStates)[number];

/**
 * One tracked DNS record, identified by `(name, record_type, value)`. Making the normalized
 * value part of the key is what lets a sixth MX beside five existing ones read as one
 * addition, since an RRset itself is just a set of RDATA with no identity of its own.
 */
export const dnsMonitorRecords = table({
	name: "dns_monitor_records",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		dns_monitor_id: c.text(),
		/** Absolute owner name, lowercased, no trailing dot. The apex is `domain` itself. */
		name: c.text(),
		record_type: c.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]),
		/** Normalized RDATA, per-type folding applied at write time. Part of the identity. */
		value: c.text(),
		/** How this row first entered the table. */
		source: c.enum(["resolver", "zone_file"]),
		/** Whether a deviation from this record alerts. Discovery-time default is `true`. */
		is_enabled: c.boolean().default(true),
		status: c.enum(dnsRecordStates),
		first_seen_at: c.integer(),
		/** Last check at which this exact record resolved. `null` for zone-file-only rows. */
		last_seen_at: c.integer().nullable(),
		last_checked_at: c.integer().nullable(),
	},
});

export type SelectDnsMonitorRecord = TableRow<typeof dnsMonitorRecords>;
export type InsertDnsMonitorRecord = InsertRow<typeof dnsMonitorRecords>;

export const dnsMonitorResults = table({
	name: "dns_monitor_results",
	columns: {
		id: c.text().primaryKey(),
		dns_monitor_id: c.text(),
		status: c.enum(["ok", "changed", "error"]),
		/**
		 * Counters: one row per check of the monitor, so retention volume holds steady
		 * regardless of how many names get swept. Each defaults to `0`, so a caller with
		 * nothing to report can still insert a truthful zero.
		 */
		records_checked: c.integer().default(0),
		records_changed: c.integer().default(0),
		records_missing: c.integer().default(0),
		records_new: c.integer().default(0),
		/**
		 * Queries that did not answer. A failed query is never diffed, so this is what keeps a
		 * resolver having a bad minute from reading as "every record at that name vanished".
		 */
		queries_failed: c.integer().default(0),
		/**
		 * The slowest single query in the sweep. The column means "how long did DNS take
		 * to answer" and feeds a latency chart; summing would quietly turn that chart into
		 * a cost chart.
		 */
		response_time_ms: c.integer().nullable(),
		error_message: c.text().nullable(),
		checked_at: c.integer(),
	},
});

export type SelectDnsMonitorResult = TableRow<typeof dnsMonitorResults>;
export type InsertDnsMonitorResult = InsertRow<typeof dnsMonitorResults>;

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

export const sslMonitors = table({
	name: "ssl_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		enabled_at: c.integer().nullable(),
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
		/**
		 * Which monitor table {@link alerts.monitor_id} points into; `null` in both columns
		 * means every monitor of every type. Cast because a nullable enum column infers as
		 * `string | null`, which would otherwise leak into every scope comparison.
		 */
		monitor_type: c.enum(["http", "dns", "tcp", "cron", "flow"]).nullable() as ColumnBuilder<
			"http" | "dns" | "tcp" | "cron" | "flow" | null
		>,
		monitor_id: c.text().nullable(),
		name: c.text(),
		notify_on_recovery: c.boolean().default(true),
		/**
		 * How long an outage stays quiet between notifications — without a floor, a
		 * 1-minute monitor would alert once a minute for the whole outage. Legacy `0`
		 * values stay legal and are floored at dispatch time (`app/services/alerts.ts`).
		 */
		cooldown_minutes: c.integer().default(60),
		config: c.json() as ColumnBuilder<AlertConfig>,
	},
});

export type SelectAlert = TableRow<typeof alerts>;
export type InsertAlert = InsertRow<typeof alerts>;

/**
 * One record-level observation a domain sweep made, as the alert reports it. `kind` is the
 * diff's own vocabulary, since each outcome wants a different reaction, and every string
 * field, like `recordType`, keeps stored JSON snapshots readable as the type set grows.
 */
export interface DnsFinding {
	kind: "missing" | "new" | "changed";
	/** Absolute owner name the record sits at. */
	name: string;
	recordType: string;
	/** Normalized RDATA — for a `changed` record, the value it now resolves to. */
	value: string;
}

export type AlertEventSnapshot =
	| {
			type: "http";
			responseStatus: number;
			responseTimeMs: number;
			expectedStatus: number;
			url: string;
	  }
	/**
	 * A DNS monitor watches a whole domain, so the counters are totals across every
	 * tracked record and `findings` is a capped sample of the same three buckets —
	 * `recordsMissing + recordsChanged + recordsNew` is the count before the cap.
	 */
	| {
			type: "dns";
			status: string;
			domain: string;
			recordsChanged: number;
			recordsMissing: number;
			recordsNew: number;
			/** A capped sample — see `MAX_SNAPSHOT_FINDINGS` in `app/services/alerts.ts`. */
			findings: DnsFinding[];
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
	/**
	 * A flow's counters plus the one assertion that broke it, which is the whole incident
	 * artifact (ADR-027 §8): a run reports the first failure and stops, so a reader gets the
	 * test that failed and why instead of a status code to go and interpret.
	 */
	| {
			type: "flow";
			status: string;
			testsTotal: number;
			testsPassed: number;
			testsFailed: number;
			failedTest: string | null;
			/** 1-based line of the spec source the failure happened on. */
			failedAtLine: number | null;
			failureDetail: string | null;
			durationMs: number | null;
	  }
	| {
			type: "ssl";
			status: string;
			expiresAt: string | null;
			daysUntilExpiry: number | null;
			hostname: string;
	  };

/**
 * What became of one alert delivery attempt. Every reason an alert was recorded without
 * being delivered is named `skipped_*`, so the pipeline and history view treat suppressions
 * as a group; `skipped_cap` stays for rows written while that ceiling still existed.
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
		monitor_type: c.enum(["http", "dns", "tcp", "cron", "flow", "ssl"]).nullable(),
		monitor_name: c.text().nullable(),
		snapshot: (c.json() as ColumnBuilder<AlertEventSnapshot>).nullable(),
	},
});

export type SelectAlertEvent = TableRow<typeof alertEvents>;
export type InsertAlertEvent = InsertRow<typeof alertEvents>;

export const maintenanceWindows = table({
	name: "maintenance_windows",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		/**
		 * Which monitor table {@link maintenanceWindows.monitor_id} points into; `null` in
		 * both columns means every monitor of every type. Cast because the nullable enum
		 * infers as `string | null`, which would otherwise leak into scope comparisons.
		 */
		monitor_type: c.enum(["http", "dns", "tcp", "cron", "flow"]).nullable() as ColumnBuilder<
			"http" | "dns" | "tcp" | "cron" | "flow" | null
		>,
		monitor_id: c.text().nullable(),
		name: c.text(),
		starts_at: c.integer(),
		ends_at: c.integer(),
		ended_early_at: c.integer().nullable(),
		suppress_alerts: c.boolean().default(true),
		show_on_status_page: c.boolean().default(true),
		is_recurring: c.boolean().default(false),
		/**
		 * @example "weekly:monday:02:00-04:00"
		 */
		recurring_pattern: c.text().nullable(),
	},
});

export type SelectMaintenanceWindow = TableRow<typeof maintenanceWindows>;
export type InsertMaintenanceWindow = InsertRow<typeof maintenanceWindows>;

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

/**
 * Physical table has no `id`/timestamp columns or an enforced unique constraint, but the
 * framework requires at least one primary-key column — the pair is the natural key.
 */
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

/**
 * Physical table has no `id`/timestamp columns or an enforced unique constraint, but the
 * framework requires at least one primary-key column — the pair is the natural key.
 */
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

/**
 * Which flow monitors a status page publishes. `display_name` is how a team names the
 * journey for its own users, and the only text this table holds: a flow's `source` is
 * credentialed and never reaches a public page (ADR-027 §8).
 */
export const statusPageFlowMonitors = table({
	name: "status_page_flow_monitors",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		status_page_id: c.text(),
		flow_monitor_id: c.text(),
		display_name: c.text().nullable(),
		order: c.integer().default(0),
	},
});

export type SelectStatusPageFlowMonitor = TableRow<typeof statusPageFlowMonitors>;
export type InsertStatusPageFlowMonitor = InsertRow<typeof statusPageFlowMonitors>;

export const monitorDailyStats = table({
	name: "monitor_daily_stats",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		monitor_id: c.text(),
		monitor_type: c.enum(["http", "dns", "tcp", "cron", "flow"]),
		/**
		 * @example "2026-02-14"
		 */
		date: c.text(),
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

/**
 * A **projection** of the billing platform's subscription state (ADR-005): the platform stays
 * authoritative, and only the webhook and the daily reconciliation sweep write here, keeping
 * authorisation to one indexed read per request. Rows persist after a subscription ends;
 * `status` says how.
 */
export const subscriptions = table({
	name: "subscriptions",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/**
		 * The OIDC subject the billing customer is linked to by `Customer.provision`, which
		 * equals `teams.owner_id` — so authorisation needs no join hop from a team to its
		 * billing identity.
		 */
		external_customer_id: c.text(),
		billing_subscription_id: c.text(),
		/** Our own name for what was bought, never the platform's product id. */
		billing_product_slug: c.text(),
		/** The normalized subscription status, not an app enum — see `isEntitlingStatus`. */
		status: c.text(),
		current_period_end: c.integer().nullable(),
		revoked_at: c.integer().nullable(),
		/**
		 * When the platform answered the snapshot this row was written from — the version
		 * stamp the write orders by, since a repair sweep and a delivery can read
		 * concurrently. `updated_at` only records when this app wrote the row.
		 */
		billing_read_at: c.integer(),
	},
});

export type SelectSubscription = TableRow<typeof subscriptions>;
export type InsertSubscription = InsertRow<typeof subscriptions>;

/**
 * Every billing delivery this app has received, written with the signature verdict before
 * anything trusts it. It is what makes a redelivery cheap to recognise — the platform retries
 * the same delivery id — and it keeps the body that a signature covered, so a handler that
 * turned out to be wrong can be answered for after the fact.
 *
 * `valid` and `processed` are separate because a forged delivery is worth keeping as evidence
 * while an unprocessed one is worth repairing, which the daily sweep does by re-reading the
 * customer rather than by replaying the row.
 */
export const billingWebhookDeliveries = table({
	name: "billing_webhook_deliveries",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		/** The platform's own delivery id, which is the deduplication key. */
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/** Type of the object the delivery named, or `unknown` when it named none. */
		type: c.text(),
		/** The body exactly as received, so a replay is judged against the same bytes. */
		payload: c.text(),
		valid: c.integer(),
		processed: c.integer(),
	},
});

export type SelectBillingWebhookDelivery = TableRow<typeof billingWebhookDeliveries>;
export type InsertBillingWebhookDelivery = InsertRow<typeof billingWebhookDeliveries>;

/**
 * Someone who probed a target on the public trial page and left an email to be followed up
 * on, staying anonymous and unbilled until they actually sign up. Everything tied to one
 * attempt lives on {@link trialWatches}; `last_digest_at` here is the one schedule per person.
 */
export const leads = table({
	name: "leads",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/**
		 * The address as it was last typed, the one every email is delivered to.
		 * {@link leads.normalized_email} is the row's real identity, so a `+tag` variant keeps
		 * receiving mail as spelled; a repeat submission overwrites this with the newest spelling.
		 */
		email: c.text(),
		/**
		 * The address reduced to the person behind it — lowercased, `+tag` removed, dots
		 * kept (see `normalizeLeadEmail`) — and the row's unique, real identity: one person
		 * can't split into two leads or two free weeks by tagging, and sign-in matches on it.
		 */
		normalized_email: c.text().unique(),
		/**
		 * The random, unguessable token every trial email's unsubscribe link carries — the
		 * only credential a lead ever holds, since they never made an account. Generated
		 * purely at random, so no one could unsubscribe another address just by guessing it.
		 */
		unsubscribe_token: c.text().unique(),
		/** Which language every follow-up email goes out in, taken from the page they used. */
		locale: c.enum(supportedLanguages),
		/**
		 * When they ticked the marketing opt-in, or `null` when they never did. This gates
		 * every send beyond the digest and wrap-up, which go out regardless as the service
		 * asked for. `Lead.deleteOrphaned` still takes the row once the last watch is gone.
		 */
		consented_at: c.integer().nullable(),
		/**
		 * When the last daily digest went out — the one schedule keyed to the person's
		 * single inbox. See `shouldSendDigest` for the once-per-day bound this enforces
		 * and `Lead.listDueForDigest` for the query it drives.
		 */
		last_digest_at: c.integer().nullable(),
		/**
		 * How many trial emails this address has actually been sent, counted one at a time
		 * by `Lead.recordEmailSent` after a transport accepts each message — a lifetime
		 * total, copied onto {@link trialConversions} once, at conversion.
		 */
		emails_sent: c.integer().default(0),
	},
});

export type SelectLead = TableRow<typeof leads>;
export type InsertLead = InsertRow<typeof leads>;

/**
 * One URL from the public trial page, re-checked hourly for seven days. `expires_at` ends
 * checking at day 7; `converts_until` ends the sign-up offer at day 30 — independent per
 * watch, since each attempt is its own offer, and the row survives until that offer expires.
 */
export const trialWatches = table({
	name: "trial_watches",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		lead_id: c.text(),
		/**
		 * The URL being watched, exactly as the probe resolved it — the one that is fetched
		 * hourly, reported in every email, and turned into a real HTTP monitor by a conversion.
		 */
		url: c.text(),
		/**
		 * The same URL reduced to the endpoint behind it (see `normalizeTrialUrl`), used to
		 * decide whether this lead already has a free week running on this target. Stored so
		 * the cap's lookup is an indexed equality, leaving `url` free to stay verbatim.
		 */
		normalized_url: c.text(),
		/**
		 * The random, unguessable token the seven-day report page is addressed by, generated
		 * once and kept for good, since the link already sits in an inbox. Kept separate
		 * from `leads.unsubscribe_token`, so sharing this page only ever grants a read.
		 */
		report_token: c.text().unique(),
		/**
		 * Fixed at one hour by the product, but stored as a column so this table is claimable
		 * by the same `claimDue` statement the three monitor tables use, which advances
		 * `next_due_at` in terms of this column — a cadence a migration could change.
		 */
		interval_seconds: c.integer().default(3600),
		/**
		 * When the next hourly check is owed, or `null` when the watch is finished. Same
		 * column, same meaning, same claim as `monitors.next_due_at`: nulling it at expiry
		 * is how a finished watch leaves the sweep, and it is what "active" means to the digest.
		 */
		next_due_at: c.integer().nullable(),
		/** `created_at` + 7 days: when checking stops and the weekly wrap-up goes out. */
		expires_at: c.integer(),
		/**
		 * `created_at` + 30 days: when the offer to turn this target into a real monitor on
		 * sign-up runs out. Stored so the deadline an attempt was actually given survives a
		 * change to the policy constant, and the cleanup sweep is an indexed range on one column.
		 */
		converts_until: c.integer(),
		/**
		 * The previous check's status, the entire basis for detecting a change: a sweep
		 * answers "is this different from last hour?" straight from this column, while the
		 * history table below is what a digest renders.
		 */
		last_status: c.enum(monitorStatuses).nullable(),
		/**
		 * Running totals a digest reads directly, redundant with `trial_watch_results` on
		 * purpose: every digest wants totals for every target, so the common read stays the
		 * one row already returned, cheap regardless of how many checks the watch has run.
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
		 * When this watch's seven-day wrap-up went out, set once. Kept per watch since
		 * watches started on different days end on different days — a lead who tried URLs
		 * on days 0, 3 and 6 is wrapped up on days 7, 10 and 13, one email per target.
		 */
		summary_sent_at: c.integer().nullable(),
		/**
		 * The real monitor this target became and when, or `null` while still only a trial.
		 * Kept per watch, since that is the only shape that can represent a partial
		 * conversion, and it is the idempotency guard: a second sign-in creates nothing new.
		 */
		converted_monitor_id: c.text().nullable(),
		converted_at: c.integer().nullable(),
	},
});

export type SelectTrialWatch = TableRow<typeof trialWatches>;
export type InsertTrialWatch = InsertRow<typeof trialWatches>;

/**
 * One trial check, shaped like `dns_monitor_results` and `tcp_monitor_results` so a digest
 * can draw an uptime bar over these rows. The sweep deletes them by following the watch
 * past its `converts_until`, since deleting by an age of their own could outlive or orphan it.
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

/**
 * One account that came through the public trial, keyed on the OIDC subject — the identity
 * that survives an unsubscribe — so this table stays untouched when a lead is erased. Every
 * fact here is a snapshot copied at sign-up, since the source rows are gone within a month.
 */
export const trialConversions = table({
	name: "trial_conversions",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/**
		 * The OIDC subject, which is also `teams.owner_id`. Unique, so the sign-in path's write
		 * is an upsert: it runs on every sign-in and a second row would double every count.
		 */
		owner_id: c.text().unique(),
		/** When the lead was first created, copied off it — the start of "days to convert". */
		lead_created_at: c.integer(),
		/** How many trial emails they had received by sign-up, copied off `leads.emails_sent`. */
		emails_sent: c.integer().default(0),
		/** How many URLs they had tried, copied off their watches. */
		watch_count: c.integer().default(0),
		/**
		 * The URLs themselves, as a JSON array of strings. Denormalized deliberately: the
		 * watches are gone in a month, and a child table would need its own sweep exemption
		 * to survive as long as this row does.
		 */
		urls: c.text(),
		/**
		 * Where they first arrived — three short slugs and a path, copied off the session's
		 * first-touch record. This row outlives an unsubscribe, so nothing personal belongs
		 * here; a missing value, common when attribution never ran, reads as unknown.
		 */
		landing_path: c.text().nullable(),
		campaign_source: c.text().nullable(),
		campaign_name: c.text().nullable(),
		/** Set by the first sign-in that claims a trial target, and fixed from then on. */
		signed_up_at: c.integer(),
		/**
		 * When they first became entitled to a paid subscription, or `null` while still on
		 * the free tier. First payment wins and is the column's only write, keeping "days
		 * from lead to paid" accurate against renewals, plan changes and repaired webhooks.
		 */
		paid_at: c.integer().nullable(),
	},
});

export type SelectTrialConversion = TableRow<typeof trialConversions>;
export type InsertTrialConversion = InsertRow<typeof trialConversions>;

/**
 * One reported day of the trial funnel, written by the report job and never recomputed —
 * the only version of the day that stays true, since leads and watches are swept within
 * thirty days. Written as a row of zeroes on a quiet run; `date` is unique, so a re-run overwrites it.
 */
export const trialDailyStats = table({
	name: "trial_daily_stats",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		/** The reported UTC day as `YYYY-MM-DD`, and the row's real key. */
		date: c.text().unique(),
		/** Addresses handed over for the first time that day. */
		new_leads: c.integer().default(0),
		/** URLs submitted to the free form that day, one per watch created. */
		urls_checked: c.integer().default(0),
		/** Trial emails accepted by the transport that day, across every lead. */
		emails_sent: c.integer().default(0),
		/** Leads who signed in and became a free account that day. */
		free_signups: c.integer().default(0),
		/** Converted accounts whose first payment landed that day. */
		paid_conversions: c.integer().default(0),
	},
});

export type SelectTrialDailyStats = TableRow<typeof trialDailyStats>;
export type InsertTrialDailyStats = InsertRow<typeof trialDailyStats>;

/**
 * What a flow check concluded. `down` is a failed assertion — the flow is broken. `error`
 * is this app failing to find out, from a spec that won't parse to a host outside its
 * allowed reach — the same split the HTTP check draws, keeping a mistyped spec from paging anyone.
 */
export const flowStatuses = ["up", "down", "error"] as const;

export type FlowStatus = (typeof flowStatuses)[number];

/**
 * A flow monitor: several requests and the assertions that make them a flow, written as an
 * executable spec (ADR-027) — a sequence question no single HTTP check can ask. Limited to
 * permission-gated tool calls, running one needs no sandbox beyond the grants derived here.
 */
export const flowMonitors = table({
	name: "flow_monitors",
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		team_id: c.text(),
		name: c.text(),
		/**
		 * The spec source, verbatim as written. The `net` grant a run gets is computed from
		 * the team's verified domains every time, so a monitor only ever drives a domain the
		 * team has proved it owns, and un-verifying one stops its flows at the very next check.
		 */
		source: c.text(),
		/**
		 * One of `FLOW_INTERVALS_SECONDS`, defaulting to an hour (ADR-027 §7a) — a fixed
		 * list, since a flow run costs orders of magnitude more than a single ping, making
		 * the interval a commercial term with a price printed beside every selectable value.
		 */
		interval_seconds: c.integer().default(3_600),
		/** Same column, same meaning, as on every other monitor table (ADR-006). */
		next_due_at: c.integer().nullable(),
		is_enabled: c.boolean().default(true),
		last_checked_at: c.integer().nullable(),
		last_status: c.enum(flowStatuses).nullable(),
	},
});

export type SelectFlowMonitor = TableRow<typeof flowMonitors>;
export type InsertFlowMonitor = InsertRow<typeof flowMonitors>;

/**
 * One flow check's outcome: counters plus the first failure. What makes this readable
 * during an incident is the assertion that broke and where, and a per-step log would
 * multiply retention volume by the step count to add detail nobody reads twice.
 */
export const flowMonitorResults = table({
	name: "flow_monitor_results",
	columns: {
		id: c.text().primaryKey(),
		flow_monitor_id: c.text(),
		status: c.enum(flowStatuses),
		tests_total: c.integer().default(0),
		tests_passed: c.integer().default(0),
		tests_failed: c.integer().default(0),
		/**
		 * HTTP requests the run performed. The billable quantity: a flow run is metered as
		 * one ping per request, because that is what it costs and what it is — several pings
		 * with assertions between them.
		 */
		requests_made: c.integer().default(0),
		/** The first failing test's title, and the line of the source it failed on. */
		failed_test: c.text().nullable(),
		failed_at_line: c.integer().nullable(),
		/** The formatted first failure: what was expected, what was observed. */
		failure_detail: c.text().nullable(),
		/** Wall-clock of the whole run, which is also the monitor's latency series. */
		duration_ms: c.integer().nullable(),
		/** Why the run could not be performed at all. Only set alongside an `error` status. */
		error_message: c.text().nullable(),
		checked_at: c.integer(),
	},
});

export type SelectFlowMonitorResult = TableRow<typeof flowMonitorResults>;
export type InsertFlowMonitorResult = InsertRow<typeof flowMonitorResults>;
