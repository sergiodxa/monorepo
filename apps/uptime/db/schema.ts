import { uuid, pk, timestamp, url } from "@pkg/db-helpers";
import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = timestamp("created_at")
	.notNull()
	.$defaultFn(() => new Date());

const updatedAt = timestamp("updated_at")
	.notNull()
	.$defaultFn(() => new Date())
	.$onUpdateFn(() => new Date());

export const teams = sqliteTable("teams", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	// Relations
	ownerId: uuid("owner_id").notNull(),
	// Attributes
	name: text("name").notNull(),
	slug: text("slug", { mode: "text", length: 255 }).notNull(),
	logo: url("logo"),
});

export const memberships = sqliteTable(
	"memberships",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		subjectId: uuid("subject_id").notNull(),
		teamId: uuid("team_id").notNull(),
		// Attributes
		role: text("role", { enum: ["member", "admin"] })
			.notNull()
			.default("member"),
	},
	(table) => [
		index("memberships_team_idx").on(table.teamId),
		index("memberships_subject_idx").on(table.subjectId),
		index("memberships_subject_team_idx").on(table.subjectId, table.teamId),
	],
);

export const invites = sqliteTable("invites", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	acceptedAt: timestamp("accepted_at"),
	// Relations
	senderId: uuid("sender_id").notNull(),
	teamId: uuid("team_id").notNull(),
	// Attributes
	email: text("email").notNull(),
});

export const teamDomains = sqliteTable(
	"team_domains",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		verifiedAt: timestamp("verified_at"),
		// Relations
		teamId: uuid("team_id").notNull(),
		// Attributes
		hostname: text("hostname").notNull(),
	},
	(table) => [index("team_domains_verified_hostname_idx").on(table.verifiedAt, table.hostname)],
);

export const monitors = sqliteTable(
	"monitors",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		enabledAt: timestamp("enabled_at").$defaultFn(() => new Date()),
		// Relations
		teamId: uuid("team_id").notNull(),
		authorId: uuid("author_id").notNull(),
		// Attributes
		name: text("name").notNull(),
		url: url("url").notNull(),
		method: text("method", {
			enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
		})
			.default("HEAD")
			.notNull(),
		expectedStatus: integer("expected_status").default(200).notNull(),
		intervalSeconds: integer("interval_seconds").default(60).notNull(),
		degradedAfterMs: integer("degraded_after_ms").default(5000).notNull(),
		timeoutSeconds: integer("timeout_seconds").default(10).notNull(),
		locationHint: text("location_hint", {
			enum: ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"],
		})
			.default("wnam")
			.notNull(),
		// SSL Monitoring
		sslMonitoringEnabled: integer("ssl_monitoring_enabled", { mode: "boolean" })
			.default(false)
			.notNull(),
		sslExpiryWarningDays: integer("ssl_expiry_warning_days").default(30).notNull(),
		sslExpiresAt: timestamp("ssl_expires_at"),
		sslIssuer: text("ssl_issuer"),
		sslLastCheckedAt: timestamp("ssl_last_checked_at"),
		sslStatus: text("ssl_status", {
			enum: ["unknown", "valid", "expiring", "expired", "error"],
		}).default("unknown"),
	},
	(table) => [
		index("monitors_created_at_idx").on(table.createdAt),
		index("monitors_team_idx").on(table.teamId),
	],
);

export const monitorResults = sqliteTable(
	"monitor_results",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		completedAt: timestamp("completed_at"),
		// Relations
		monitorId: uuid("monitor_id").notNull(),
		// Attributes
		responseStatus: integer("response_status"),
		responseTimeMs: integer("response_time_ms"),
	},
	(table) => [
		index("monitor_results_created_at_idx").on(table.createdAt),
		index("monitor_results_monitor_completed_at_response_status_response_time_idx").on(
			table.monitorId,
			table.completedAt,
			table.responseStatus,
			table.responseTimeMs,
		),
	],
);

export const alerts = sqliteTable("alerts", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	// Relations
	teamId: uuid("team_id").notNull(),
	monitorId: uuid("monitor_id"),
	// Attributes
	name: text("name").notNull(),
	notifyOnRecovery: integer("notify_on_recovery", { mode: "boolean" }).notNull().default(true),
	cooldownMinutes: integer("cooldown_minutes").notNull().default(0), // 0 = no cooldown
	config: text("config", { mode: "json" })
		.$type<
			| { strategy: "webhook"; config: { url: string; secret: string } }
			| { strategy: "email"; config: { to: string; subjectPrefix: string } }
			| { strategy: "slack"; config: { webhookUrl: string; channel?: string } }
			| { strategy: "discord"; config: { webhookUrl: string } }
		>()
		.notNull(),
});

export const alertEvents = sqliteTable(
	"alert_events",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		sentAt: timestamp("sent_at").notNull(),
		// Relations
		alertId: uuid("alert_id").notNull(),
		monitorId: uuid("monitor_id").notNull(),
		// Attributes
		eventType: text("event_type", { enum: ["down", "up", "degraded"] }).notNull(),
		status: text("status", { enum: ["sent", "skipped_cooldown", "failed"] }).notNull(),
		errorMessage: text("error_message"),
	},
	(table) => [
		index("alert_events_alert_id_idx").on(table.alertId),
		index("alert_events_monitor_id_idx").on(table.monitorId),
		index("alert_events_sent_at_idx").on(table.sentAt),
		index("alert_events_alert_monitor_event_sent_idx").on(
			table.alertId,
			table.monitorId,
			table.eventType,
			table.sentAt,
		),
	],
);

// Relations

export const teamsRelations = relations(teams, ({ many }) => {
	return {
		memberships: many(memberships),
		invites: many(invites),
		domains: many(teamDomains),
		monitors: many(monitors),
		alerts: many(alerts),
		statusPages: many(statusPages),
		maintenanceWindows: many(maintenanceWindows),
		dnsMonitors: many(dnsMonitors),
		tcpMonitors: many(tcpMonitors),
		apiKeys: many(apiKeys),
		cronJobMonitors: many(cronJobMonitors),
	};
});

export const membershipsRelations = relations(memberships, ({ one }) => {
	return {
		team: one(teams, {
			fields: [memberships.teamId],
			references: [teams.id],
		}),
	};
});

export const invitesRelations = relations(invites, ({ one }) => {
	return {
		team: one(teams, {
			fields: [invites.teamId],
			references: [teams.id],
		}),
	};
});

export const teamDomainsRelations = relations(teamDomains, ({ one }) => {
	return {
		team: one(teams, {
			fields: [teamDomains.teamId],
			references: [teams.id],
		}),
	};
});

export const monitorsRelations = relations(monitors, ({ many, one }) => {
	return {
		team: one(teams, {
			fields: [monitors.teamId],
			references: [teams.id],
		}),
		results: many(monitorResults),
		alerts: many(alerts),
		statusPageMonitors: many(statusPageMonitors),
		contentChecks: many(monitorContentChecks),
	};
});

export const monitorResultsRelations = relations(monitorResults, ({ one }) => {
	return {
		monitor: one(monitors, {
			fields: [monitorResults.monitorId],
			references: [monitors.id],
		}),
	};
});

export const alertsRelations = relations(alerts, ({ one, many }) => {
	return {
		team: one(teams, {
			fields: [alerts.teamId],
			references: [teams.id],
		}),
		monitor: one(monitors, {
			fields: [alerts.monitorId],
			references: [monitors.id],
		}),
		events: many(alertEvents),
	};
});

export const alertEventsRelations = relations(alertEvents, ({ one }) => {
	return {
		alert: one(alerts, {
			fields: [alertEvents.alertId],
			references: [alerts.id],
		}),
		monitor: one(monitors, {
			fields: [alertEvents.monitorId],
			references: [monitors.id],
		}),
	};
});

export const statusPages = sqliteTable(
	"status_pages",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		teamId: uuid("team_id").notNull(),
		// Attributes
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		title: text("title").notNull(),
		description: text("description"),
		logoUrl: url("logo_url"),
		customDomain: text("custom_domain"),
		isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
		showOverallStatus: integer("show_overall_status", { mode: "boolean" }).notNull().default(true),
	},
	(table) => [
		index("status_pages_team_idx").on(table.teamId),
		index("status_pages_slug_idx").on(table.slug),
	],
);

export const statusPageMonitors = sqliteTable(
	"status_page_monitors",
	{
		// Relations (composite primary key)
		statusPageId: uuid("status_page_id").notNull(),
		monitorId: uuid("monitor_id").notNull(),
		// Attributes
		displayName: text("display_name"),
		order: integer("order").notNull().default(0),
	},
	(table) => [
		index("status_page_monitors_status_page_idx").on(table.statusPageId),
		index("status_page_monitors_monitor_idx").on(table.monitorId),
	],
);

export const statusPagesRelations = relations(statusPages, ({ one, many }) => {
	return {
		team: one(teams, {
			fields: [statusPages.teamId],
			references: [teams.id],
		}),
		monitors: many(statusPageMonitors),
		cronJobs: many(statusPageCronJobs),
	};
});

export const statusPageMonitorsRelations = relations(statusPageMonitors, ({ one }) => {
	return {
		statusPage: one(statusPages, {
			fields: [statusPageMonitors.statusPageId],
			references: [statusPages.id],
		}),
		monitor: one(monitors, {
			fields: [statusPageMonitors.monitorId],
			references: [monitors.id],
		}),
	};
});

export const maintenanceWindows = sqliteTable(
	"maintenance_windows",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		teamId: uuid("team_id").notNull(),
		monitorId: uuid("monitor_id"), // null means all monitors
		// Attributes
		name: text("name").notNull(),
		startsAt: timestamp("starts_at").notNull(),
		endsAt: timestamp("ends_at").notNull(),
		endedEarlyAt: timestamp("ended_early_at"), // For manual early termination
		suppressAlerts: integer("suppress_alerts", { mode: "boolean" }).default(true).notNull(),
		showOnStatusPage: integer("show_on_status_page", { mode: "boolean" }).default(true).notNull(),
		isRecurring: integer("is_recurring", { mode: "boolean" }).default(false).notNull(),
		recurringPattern: text("recurring_pattern"), // e.g., "weekly:monday:02:00-04:00"
	},
	(table) => [
		index("maintenance_windows_team_idx").on(table.teamId),
		index("maintenance_windows_monitor_idx").on(table.monitorId),
		index("maintenance_windows_starts_at_ends_at_idx").on(table.startsAt, table.endsAt),
	],
);

export const maintenanceWindowsRelations = relations(maintenanceWindows, ({ one }) => {
	return {
		team: one(teams, {
			fields: [maintenanceWindows.teamId],
			references: [teams.id],
		}),
		monitor: one(monitors, {
			fields: [maintenanceWindows.monitorId],
			references: [monitors.id],
		}),
	};
});

export const monitorContentChecks = sqliteTable(
	"monitor_content_checks",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		monitorId: uuid("monitor_id").notNull(),
		// Attributes
		type: text("type", { enum: ["contains", "not_contains", "regex"] }).notNull(),
		value: text("value").notNull(),
		caseSensitive: integer("case_sensitive", { mode: "boolean" }).default(false).notNull(),
		isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
	},
	(table) => [
		index("monitor_content_checks_monitor_idx").on(table.monitorId),
		index("monitor_content_checks_monitor_enabled_idx").on(table.monitorId, table.isEnabled),
	],
);

export const monitorContentChecksRelations = relations(monitorContentChecks, ({ one }) => {
	return {
		monitor: one(monitors, {
			fields: [monitorContentChecks.monitorId],
			references: [monitors.id],
		}),
	};
});

// DNS Monitors

export const dnsMonitors = sqliteTable(
	"dns_monitors",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		teamId: uuid("team_id").notNull(),
		// Attributes
		name: text("name").notNull(),
		domain: text("domain").notNull(),
		recordType: text("record_type", {
			enum: ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
		}).notNull(),
		expectedValue: text("expected_value"),
		intervalSeconds: integer("interval_seconds").default(3600).notNull(),
		isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
		lastCheckedAt: timestamp("last_checked_at"),
		lastStatus: text("last_status", { enum: ["ok", "changed", "error"] }),
		lastValue: text("last_value"),
	},
	(table) => [
		index("dns_monitors_team_idx").on(table.teamId),
		index("dns_monitors_is_enabled_idx").on(table.isEnabled),
	],
);

export const dnsMonitorResults = sqliteTable(
	"dns_monitor_results",
	{
		id: pk("id"),
		// Relations
		dnsMonitorId: uuid("dns_monitor_id").notNull(),
		// Attributes
		status: text("status", { enum: ["ok", "changed", "error"] }).notNull(),
		resolvedValue: text("resolved_value"),
		responseTimeMs: integer("response_time_ms"),
		errorMessage: text("error_message"),
		checkedAt: timestamp("checked_at").notNull(),
	},
	(table) => [
		index("dns_monitor_results_dns_monitor_idx").on(table.dnsMonitorId),
		index("dns_monitor_results_checked_at_idx").on(table.checkedAt),
	],
);

export const dnsMonitorsRelations = relations(dnsMonitors, ({ one, many }) => {
	return {
		team: one(teams, {
			fields: [dnsMonitors.teamId],
			references: [teams.id],
		}),
		results: many(dnsMonitorResults),
	};
});

export const dnsMonitorResultsRelations = relations(dnsMonitorResults, ({ one }) => {
	return {
		dnsMonitor: one(dnsMonitors, {
			fields: [dnsMonitorResults.dnsMonitorId],
			references: [dnsMonitors.id],
		}),
	};
});

// Cron Job Monitors

export const cronJobStatusEnum = ["healthy", "late", "missed", "new"] as const;
export type CronJobStatus = (typeof cronJobStatusEnum)[number];

export const cronJobMonitors = sqliteTable(
	"cron_job_monitors",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		teamId: uuid("team_id").notNull(),
		// Attributes
		name: text("name").notNull(),
		description: text("description"),
		cronExpression: text("cron_expression").notNull(),
		gracePeriodSeconds: integer("grace_period_seconds").notNull().default(300),
		timezone: text("timezone").notNull().default("UTC"),
		status: text("status", { enum: cronJobStatusEnum }).notNull().default("new"),
		alertOnLate: integer("alert_on_late", { mode: "boolean" }).notNull().default(false),
		lastPingAt: timestamp("last_ping_at"),
		nextExpectedAt: timestamp("next_expected_at"),
		enabledAt: timestamp("enabled_at").$defaultFn(() => new Date()),
	},
	(table) => [
		index("cron_job_monitors_team_idx").on(table.teamId),
		index("cron_job_monitors_enabled_at_idx").on(table.enabledAt),
		index("cron_job_monitors_status_next_expected_idx").on(table.status, table.nextExpectedAt),
	],
);

export const cronJobPings = sqliteTable(
	"cron_job_pings",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		// Relations
		cronJobMonitorId: uuid("cron_job_monitor_id").notNull(),
		// Attributes
		wasOnTime: integer("was_on_time", { mode: "boolean" }).notNull(),
		sourceIp: text("source_ip"),
		userAgent: text("user_agent"),
	},
	(table) => [
		index("cron_job_pings_cron_job_monitor_idx").on(table.cronJobMonitorId),
		index("cron_job_pings_created_at_idx").on(table.createdAt),
	],
);

export const statusPageCronJobs = sqliteTable(
	"status_page_cron_jobs",
	{
		// Relations
		statusPageId: uuid("status_page_id").notNull(),
		cronJobMonitorId: uuid("cron_job_monitor_id").notNull(),
		// Attributes
		displayName: text("display_name"),
		order: integer("order").notNull().default(0),
	},
	(table) => [
		index("status_page_cron_jobs_status_page_idx").on(table.statusPageId),
		index("status_page_cron_jobs_cron_job_monitor_idx").on(table.cronJobMonitorId),
	],
);

export const cronJobMonitorsRelations = relations(cronJobMonitors, ({ one, many }) => {
	return {
		team: one(teams, {
			fields: [cronJobMonitors.teamId],
			references: [teams.id],
		}),
		pings: many(cronJobPings),
		statusPageCronJobs: many(statusPageCronJobs),
	};
});

export const cronJobPingsRelations = relations(cronJobPings, ({ one }) => {
	return {
		cronJobMonitor: one(cronJobMonitors, {
			fields: [cronJobPings.cronJobMonitorId],
			references: [cronJobMonitors.id],
		}),
	};
});

export const statusPageCronJobsRelations = relations(statusPageCronJobs, ({ one }) => {
	return {
		statusPage: one(statusPages, {
			fields: [statusPageCronJobs.statusPageId],
			references: [statusPages.id],
		}),
		cronJobMonitor: one(cronJobMonitors, {
			fields: [statusPageCronJobs.cronJobMonitorId],
			references: [cronJobMonitors.id],
		}),
	};
});

// TCP Monitors

export const tcpMonitors = sqliteTable(
	"tcp_monitors",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		teamId: uuid("team_id").notNull(),
		// Attributes
		name: text("name").notNull(),
		host: text("host").notNull(),
		port: integer("port").notNull(),
		timeoutMs: integer("timeout_ms").default(5000).notNull(),
		intervalSeconds: integer("interval_seconds").default(60).notNull(),
		isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
		lastCheckedAt: timestamp("last_checked_at"),
		lastStatus: text("last_status", { enum: ["up", "down", "timeout"] }),
		lastResponseTimeMs: integer("last_response_time_ms"),
	},
	(table) => [
		index("tcp_monitors_team_idx").on(table.teamId),
		index("tcp_monitors_is_enabled_idx").on(table.isEnabled),
	],
);

export const tcpMonitorResults = sqliteTable(
	"tcp_monitor_results",
	{
		id: pk("id"),
		// Relations
		tcpMonitorId: uuid("tcp_monitor_id").notNull(),
		// Attributes
		status: text("status", { enum: ["up", "down", "timeout"] }).notNull(),
		responseTimeMs: integer("response_time_ms"),
		errorMessage: text("error_message"),
		checkedAt: timestamp("checked_at").notNull(),
	},
	(table) => [
		index("tcp_monitor_results_tcp_monitor_idx").on(table.tcpMonitorId),
		index("tcp_monitor_results_checked_at_idx").on(table.checkedAt),
	],
);

export const tcpMonitorsRelations = relations(tcpMonitors, ({ one, many }) => {
	return {
		team: one(teams, {
			fields: [tcpMonitors.teamId],
			references: [teams.id],
		}),
		results: many(tcpMonitorResults),
	};
});

export const tcpMonitorResultsRelations = relations(tcpMonitorResults, ({ one }) => {
	return {
		tcpMonitor: one(tcpMonitors, {
			fields: [tcpMonitorResults.tcpMonitorId],
			references: [tcpMonitors.id],
		}),
	};
});

// Types

export type SelectTeam = typeof teams.$inferSelect;
export type SelectMembership = typeof memberships.$inferSelect;
export type SelectInvite = typeof invites.$inferSelect;
export type SelectTeamDomain = typeof teamDomains.$inferSelect;
export type SelectMonitor = typeof monitors.$inferSelect;
export type SelectMonitorResult = typeof monitorResults.$inferSelect;
export type SelectAlert = typeof alerts.$inferSelect;
export type SelectStatusPage = typeof statusPages.$inferSelect;
export type SelectStatusPageMonitor = typeof statusPageMonitors.$inferSelect;
export type SelectMaintenanceWindow = typeof maintenanceWindows.$inferSelect;

export type InsertTeam = typeof teams.$inferInsert;
export type InsertMembership = typeof memberships.$inferInsert;
export type InsertInvite = typeof invites.$inferInsert;
export type InsertTeamDomain = typeof teamDomains.$inferInsert;
export type InsertMonitor = typeof monitors.$inferInsert;
export type InsertMonitorResult = typeof monitorResults.$inferInsert;
export type InsertAlert = typeof alerts.$inferInsert;
export type InsertStatusPage = typeof statusPages.$inferInsert;
export type InsertStatusPageMonitor = typeof statusPageMonitors.$inferInsert;
export type InsertMaintenanceWindow = typeof maintenanceWindows.$inferInsert;

export type SelectMonitorContentCheck = typeof monitorContentChecks.$inferSelect;
export type InsertMonitorContentCheck = typeof monitorContentChecks.$inferInsert;
export type SelectDnsMonitor = typeof dnsMonitors.$inferSelect;
export type InsertDnsMonitor = typeof dnsMonitors.$inferInsert;
export type SelectDnsMonitorResult = typeof dnsMonitorResults.$inferSelect;
export type InsertDnsMonitorResult = typeof dnsMonitorResults.$inferInsert;
export type SelectAlertEvent = typeof alertEvents.$inferSelect;
export type InsertAlertEvent = typeof alertEvents.$inferInsert;
export type SelectTcpMonitor = typeof tcpMonitors.$inferSelect;
export type InsertTcpMonitor = typeof tcpMonitors.$inferInsert;
export type SelectTcpMonitorResult = typeof tcpMonitorResults.$inferSelect;
export type InsertTcpMonitorResult = typeof tcpMonitorResults.$inferInsert;
export type SelectCronJobMonitor = typeof cronJobMonitors.$inferSelect;
export type InsertCronJobMonitor = typeof cronJobMonitors.$inferInsert;
export type SelectCronJobPing = typeof cronJobPings.$inferSelect;
export type InsertCronJobPing = typeof cronJobPings.$inferInsert;
export type SelectStatusPageCronJob = typeof statusPageCronJobs.$inferSelect;
export type InsertStatusPageCronJob = typeof statusPageCronJobs.$inferInsert;

// API Keys

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

export const apiKeys = sqliteTable(
	"api_keys",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		lastUsedAt: timestamp("last_used_at"),
		expiresAt: timestamp("expires_at"),
		// Relations
		teamId: uuid("team_id").notNull(),
		// Attributes
		name: text("name").notNull(),
		keyHash: text("key_hash").notNull(),
		keyPrefix: text("key_prefix").notNull(),
		scopes: text("scopes", { mode: "json" })
			.$type<Array<(typeof apiKeyScopes)[number]>>()
			.notNull(),
	},
	(table) => [
		index("api_keys_team_idx").on(table.teamId),
		index("api_keys_key_hash_idx").on(table.keyHash),
	],
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => {
	return {
		team: one(teams, {
			fields: [apiKeys.teamId],
			references: [teams.id],
		}),
	};
});

export type SelectApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyScope = SelectApiKey["scopes"][number];

// User Preferences (for language settings)

export const supportedLanguages = ["en", "es", "de", "ja", "fr", "it"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const userPreferences = sqliteTable(
	"user_preferences",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		subjectId: uuid("subject_id").notNull().unique(),
		// Attributes
		preferredLanguage: text("preferred_language", {
			enum: supportedLanguages,
		}),
	},
	(table) => [index("user_preferences_subject_idx").on(table.subjectId)],
);

export type SelectUserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
