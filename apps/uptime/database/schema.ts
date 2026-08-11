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
		/**
		 * When this membership was last sent the daily and the weekly team digest, or `null`
		 * for one that never has been. The pair is the unit both stamps are on: one person in
		 * three teams receives three digests, so a stamp on the subject would suppress two of
		 * them and a stamp on the team would suppress every member but the first.
		 *
		 * Each is written only after a send the transport accepted, which is what makes a
		 * re-delivered trigger a no-op and a failed send a retry.
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

/**
 * Every email a member can turn off, and the value set of
 * `user_preferences.unsubscribed_emails`. Declared here, next to the column, so adding a
 * third digest is one edit rather than one per repeated union — the same reason
 * {@link apiKeyScopes} and {@link monitorStatuses} live beside theirs.
 *
 * It holds the *optional* mail only. An invite, an alert and a password-style transactional
 * message are each the answer to something somebody did, so none of them belongs in a list
 * whose whole purpose is to be switched off; a digest nobody asked for by name does.
 *
 * The settings page renders one switch per entry in this order, and each key names its own
 * copy under `page.account.emails.list.*` in the locale files.
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
		 * turned nothing off — so the default is subscribed and a member who never opened the
		 * settings page needs no row here at all.
		 *
		 * Stored as the refusals rather than as the acceptances because that is what makes the
		 * default hold without a backfill: a new digest is opt-out for everybody the moment it
		 * ships, with no row rewritten and no column added. An unknown string is ignored on
		 * read (see `UserPreferences.wants`), which is what makes retiring an email safe.
		 */
		unsubscribed_emails: (c.json() as ColumnBuilder<Array<OptionalEmail>>).nullable(),
	},
});

export type SelectUserPreferences = TableRow<typeof userPreferences>;
export type InsertUserPreferences = InsertRow<typeof userPreferences>;

/**
 * The queue of accounts asked to be deleted, one row per person waiting for the daily sweep.
 *
 * The row *is* the queue and the retry policy both: the sweep deletes it only after the whole
 * erasure succeeded and the confirmation mail was accepted, so a run that failed halfway
 * leaves it in place and tomorrow's run picks it up again. Nothing here records an attempt or
 * a backoff, because "it failed" and "it will be retried tomorrow" are the same statement.
 *
 * It is also the grace period. Deletion takes effect up to a day after it is asked for, which
 * is not a limitation of running the sweep daily — it is the window in which somebody who
 * clicked by mistake can sign back in and cancel, and the queue makes it free to offer.
 *
 * **Why `email` is stored here, on the one table whose purpose is erasure.** This app holds no
 * account-holder address anywhere else: an account is an OIDC subject, `invites.email` is an
 * invitee's address and `leads.email` a trial visitor's, and the account holder's own address
 * exists only in the ID token on the request that carries it. So the confirmation mail that
 * says "your account has been deleted" has no address to go to unless the request that asked
 * for the deletion captures one. The irony is deliberate and bounded: an erasure request is
 * the one place that must store an address in order to be fulfilled, and this row — the only
 * copy of it — is deleted at the very end of the erasure, after the mail has gone out.
 */
export const accountDeletions = table({
	name: "account_deletions",
	timestamps: { createdAt: "created_at" },
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		/** The OIDC subject to erase. Unique: asking twice is one request, not two. */
		subject_id: c.text().unique(),
		/** Address the confirmation mail goes to; see this table's docblock for why it is here. */
		email: c.text(),
		/** When the person asked, which is what the queued-state copy tells them back. */
		requested_at: c.integer(),
	},
});

export type SelectAccountDeletion = TableRow<typeof accountDeletions>;
export type InsertAccountDeletion = InsertRow<typeof accountDeletions>;

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
		 * `dns_monitors.last_status` has with `dns_monitor_results`, and the same trio
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
		/** The zone apex this monitor covers, absolute, lowercased, no trailing dot. */
		domain: c.text(),
		/**
		 * When a zone file was last pasted and parsed. The pasted text itself is deliberately
		 * never stored — a customer's complete zone is a map of their infrastructure, and a
		 * re-paste serves every feature a stored copy would. `null` means every tracked name
		 * was discovered by resolution, so the monitor covers the apex and nothing else.
		 */
		zone_file_imported_at: c.integer().nullable(),
		/**
		 * Daily by default: DNS changes are human-caused and human-paced, and a record's TTL
		 * puts a floor under detection latency that a faster interval cannot get below.
		 */
		interval_seconds: c.integer().default(86_400),
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
	},
});

export type SelectDnsMonitor = TableRow<typeof dnsMonitors>;
export type InsertDnsMonitor = InsertRow<typeof dnsMonitors>;

/**
 * What the last check found for one tracked record. `new` and `missing` are states of a
 * record, not of a check: a record stays `new` until the user enables or deletes it, and
 * `changed` is reserved for the one case a diff can attribute without guessing — a
 * name+type holding exactly one stored and one resolved record that differ.
 */
export const dnsRecordStates = ["ok", "changed", "missing", "new", "error"] as const;

export type DnsRecordState = (typeof dnsRecordStates)[number];

/**
 * One tracked DNS record, identified by `(name, record_type, value)` rather than by RRset.
 * A DNS record has no identity of its own — an RRset is a set of RDATA — so making the
 * normalized value part of the key is what lets a sixth MX appearing beside five existing
 * ones read as one addition instead of as "the MX records changed".
 *
 * The table is the complete set of everything ever seen for the domain, including records
 * the user declined to watch: `is_enabled` says only whether a deviation alerts. Without
 * that invariant a declined record would be rediscovered as `new` on every check.
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
		 * Counters, not values: one row per check of the monitor rather than per query, so
		 * retention volume does not multiply by the number of names swept. The per-record
		 * detail lives in `dns_monitor_records`, which is configuration and is not swept.
		 *
		 * Each defaults to `0` rather than being required, so a caller that has nothing to
		 * report writes a truthful zero instead of being unable to insert at all.
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
		 * The slowest single query in the sweep, not the sum. The column means "how long did
		 * DNS take to answer" and feeds a latency chart; summing would quietly turn that chart
		 * into a cost chart.
		 */
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
		// How long an ongoing outage stays quiet between notifications. An hour by
		// default, so a monitor that is still down alerts again once an hour for as long
		// as it lasts, and an hourly monitor always alerts. Rows created before this
		// default keep whatever they stored — including `0`, which is still legal here
		// and is floored at dispatch time rather than rewritten (see
		// `app/services/alerts.ts`), because an unthrottled alert on a 1-minute monitor
		// would otherwise be one email per minute for the whole outage.
		cooldown_minutes: c.integer().default(60),
		config: c.json() as ColumnBuilder<AlertConfig>,
	},
});

export type SelectAlert = TableRow<typeof alerts>;
export type InsertAlert = InsertRow<typeof alerts>;

/**
 * One record-level observation a domain sweep made, as the alert reports it.
 *
 * `kind` is the diff's own vocabulary rather than a summary of it, because the three
 * outcomes want different reactions: a watched record that stopped resolving is a
 * failure, a newly seen one is waiting to be accepted or fixed, and a `changed` one is
 * the single edit DNS lets us attribute to a record. The three fields after it are the
 * record's whole identity, which is what makes a finding quotable back to the zone.
 *
 * `recordType` is a plain string, like every `status` in this union: a snapshot is
 * stored JSON that outlives the code that wrote it, and a stored row must stay readable
 * after the supported type set grows.
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
	 * A DNS monitor watches a domain rather than one record type, so the counters and the
	 * findings describe a sweep of every tracked record instead of one resolved value.
	 *
	 * The counters are the totals; `findings` is a capped sample of the very same three
	 * buckets, so `recordsMissing + recordsChanged + recordsNew` is always the number of
	 * findings there were before the cap, and the difference is what a reader is not being
	 * shown. Both are needed: a bounded snapshot cannot hold a large zone's every finding,
	 * and a body that only quoted five of them would understate the event.
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
 *
 * `skipped_cap` is no longer produced — the per-incident send ceiling it recorded is gone,
 * see `app/services/alerts.ts` — but it stays in the union because rows written while the
 * ceiling existed still carry it, and dropping the value would make that history unreadable
 * by everything that branches on this column.
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
		 * The address as it was last typed, and the one every email is actually delivered to.
		 *
		 * Not unique, and not the identity of the row — {@link leads.normalized_email} is. The
		 * two are different things: `hello+news@x.com` is a legitimate way to write an address
		 * that must keep receiving mail exactly as spelled, while the person behind it is the
		 * same person as `hello@x.com` and must not get a second free week by tagging. A repeat
		 * submission overwrites this with whatever was typed that time, the way `locale` does,
		 * because the newest spelling is the one they are watching an inbox for.
		 */
		email: c.text(),
		/**
		 * The address reduced to the person behind it — lowercased, `+tag` removed, dots kept —
		 * and the row's real identity. See `normalizeLeadEmail` in `~/app/lib/trial-identity`
		 * for why each of those three is the way it is.
		 *
		 * Unique, and the conflict target of the create-or-update the trial form runs, for the
		 * reason the raw address used to carry it: a second row for one person would split
		 * their watches across two leads, send them two digests a day, and hand each of their
		 * tagged spellings its own free week on the same URL. It is also what the sign-in path
		 * matches a subject's address against, so somebody who tried with `hello+test@` and
		 * signed up as `hello@` still has their targets converted.
		 */
		normalized_email: c.text().unique(),
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
		/**
		 * How many trial emails this address has actually been sent, counted one at a time by
		 * `Lead.recordEmailSent` and only after a transport accepted the message.
		 *
		 * A lifetime total and not a per-day one: the question it answers is "how many emails
		 * had they received by the time they signed up", which is one number taken once, at
		 * conversion, and copied onto {@link trialConversions} so it survives this row. Counting
		 * attempts instead of accepted sends would make it a measure of what was intended rather
		 * than of what landed, which is the opposite of what a funnel wants.
		 */
		emails_sent: c.integer().default(0),
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
		/**
		 * The URL being watched, exactly as the probe resolved it — the one that is fetched
		 * hourly, reported in every email, and turned into a real HTTP monitor by a conversion.
		 */
		url: c.text(),
		/**
		 * The same URL reduced to the endpoint behind it, used for one thing only: deciding
		 * whether this lead already has a free week running on this target. See
		 * `normalizeTrialUrl` in `~/app/lib/trial-identity` for the four reductions it makes and
		 * the one it deliberately does not — `http://` and `https://` stay two different
		 * endpoints and each gets its own week.
		 *
		 * Stored rather than derived at read time so the cap's lookup is an indexed equality on
		 * `(lead_id, normalized_url)` rather than a scan over every URL that lead ever tried,
		 * and so `url` can stay verbatim for probing and display without the two ever
		 * disagreeing about which one is which.
		 *
		 * It carries no unique constraint. Nothing needs it to: a watch is deleted thirty days
		 * after it is created, so "a row exists for this pair" already *is* the thirty-day
		 * window, and the request that finds one answers with a report email rather than an
		 * error.
		 */
		normalized_url: c.text(),
		/**
		 * The random, unguessable token the seven-day report page is addressed by, generated
		 * when the watch is created and never rotated.
		 *
		 * Per watch and not per lead, and deliberately not the lead's `unsubscribe_token`. A
		 * report is meant to be reopened, forwarded to a colleague or handed to a client, and
		 * the unsubscribe token *acts*: it deletes an address and everything attached to it.
		 * Sharing a page must never hand over that power, and one token doing both jobs is the
		 * only way it could. Two tokens also keep the blast radius of a leaked link to the one
		 * URL the report is about rather than to every URL that reader ever tried.
		 *
		 * Never rotated for the reason `leads.unsubscribe_token` is never rotated: the link is
		 * already sitting in an inbox, and a new token would silently turn it into a 404.
		 *
		 * Unique and indexed because it is looked up on its own, with no lead in hand — the URL
		 * is the whole of the request, since nobody behind a trial has an account to prove
		 * anything with.
		 */
		report_token: c.text().unique(),
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
 * This is the disposable one of the three trial tables. Rows are bounded by construction —
 * 168 per watch, and then the watch stops writing — but bounded is not self-deleting.
 *
 * They live exactly as long as the watch they belong to, and the sweep deletes them by
 * following {@link trialWatchResults.trial_watch_id} to a watch past its `converts_until`
 * rather than by an age of their own. An age would be wrong now that a repeat submission is
 * answered with a report drawn from these rows: a cutoff shorter than the watch's own life
 * would leave a live watch with nothing to report, and one as long as it would delete the
 * results *after* the watch, orphaning them. Following the watch is the only shape with
 * neither failure.
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

// Trial funnel

/**
 * One account that came through the public trial: what it cost to get them there, when
 * they signed up, and when — if ever — they started paying.
 *
 * **The one trial table nothing sweeps.** The other three are deleted on a thirty-day clock
 * and an unsubscribe deletes a lead's entire history the moment it is clicked, so a row
 * here is written by copying the facts out rather than by pointing at them: `lead_created_at`,
 * `emails_sent`, `watch_count` and `urls` are snapshots taken at sign-up of rows that will
 * not exist in a month. Joining back to a lead would produce a table that answers questions
 * for thirty days and then silently stops.
 *
 * **Keyed on the subject, not on the address.** Three reasons, and they agree. Unsubscribing
 * must delete every trace of a lead, and an address kept here would be a trace. Somebody who
 * signed up is a customer rather than a lead, so the address they typed into a public form is
 * no longer the identity that matters. And the subject is `teams.owner_id`, which is
 * {@link subscriptions}' `external_customer_id` — so this table reaches billing without a hop
 * through anything that expires.
 *
 * Both dates are written once. `signed_up_at` is set by the first sign-in that converts and
 * never moved, because conversion runs on every sign-in and the interesting instant is the
 * first one; `paid_at` is set by the first entitlement that lands and never moved, because a
 * renewal is not a conversion.
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
		 * watches are gone in a month, the list is only ever read back whole to be printed in a
		 * report, and a child table would need its own sweep exemption to survive as long as
		 * this row does.
		 */
		urls: c.text(),
		/**
		 * Where they first arrived, copied off the session's first-touch record: the landing
		 * path, and the campaign the link carried when it carried one.
		 *
		 * Nullable and expected to be null for plenty of rows. Attribution lives in a session
		 * cookie, so anyone who blocks it, arrives in a fresh session, or signed up before this
		 * existed has none — and a missing attribution has to read as "unknown" rather than as
		 * "direct", which is a different and much more flattering claim.
		 *
		 * Three short slugs and a path, never a query string, a referrer, or anything the person
		 * typed. This row outlives an unsubscribe by design, so nothing personal may reach it.
		 */
		landing_path: c.text().nullable(),
		campaign_source: c.text().nullable(),
		campaign_name: c.text().nullable(),
		/** The first sign-in that claimed a trial target; never moved by a later one. */
		signed_up_at: c.integer(),
		/**
		 * When they first became entitled to a paid subscription, or `null` while they are on
		 * the free tier. First payment wins — a renewal, a plan change or a repaired webhook
		 * must not move it, or "days from lead to paid" would drift upward forever.
		 */
		paid_at: c.integer().nullable(),
	},
});

export type SelectTrialConversion = TableRow<typeof trialConversions>;
export type InsertTrialConversion = InsertRow<typeof trialConversions>;

/**
 * One reported day of the trial funnel, written by the report job and never recomputed.
 *
 * It exists because the tables these counters are drawn from do not keep their own past.
 * Leads and watches are swept at thirty days and an unsubscribe removes a lead's history
 * retroactively, so counting August in September returns a smaller number than counting
 * August in August. A stored row is the only version of the day that stays true, and it is
 * what the report's thirty-day context sums over.
 *
 * Written on every run, including a run that sends no email, so a quiet day is a row of
 * zeroes rather than a hole. `date` is unique, which is what makes a re-run overwrite the
 * day it recomputed instead of double-counting it.
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
