/**
 * Uptime's models, bound per request and per job as `ctx.models`. Each entry imports its
 * module on first use, so an invocation evaluates only the models it touches, the way routes
 * load only the controllers a request reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

/** Every model, keyed by the name `ctx.models` binds it under. */
export const models = createModels({
	accountDeletions: () => import("./account-deletions"),
	apiKeys: () => import("./api-keys"),
	billingWebhookDeliveries: () => import("./billing-webhook-deliveries"),
	invites: () => import("./invites"),
	memberships: () => import("./memberships"),
	subscriptions: () => import("./subscriptions"),
	teamDomains: () => import("./team-domains"),
	teams: () => import("./teams"),
	userPreferences: () => import("./user-preferences"),

	contentChecks: () => import("./content-checks"),
	monitorDailyStats: () => import("./monitor-daily-stats"),
	monitorResults: () => import("./monitor-results"),
	monitors: () => import("./monitors"),

	dnsMonitors: () => import("./dns-monitors"),
	dnsMonitorRecords: () => import("./dns-monitor-records"),
	dnsMonitorResults: () => import("./dns-monitor-results"),
	tcpMonitors: () => import("./tcp-monitors"),
	tcpMonitorResults: () => import("./tcp-monitor-results"),
	flowMonitors: () => import("./flow-monitors"),
	flowMonitorResults: () => import("./flow-monitor-results"),
	cronJobMonitors: () => import("./cron-job-monitors"),
	cronJobPings: () => import("./cron-job-pings"),

	alerts: () => import("./alerts"),
	alertEvents: () => import("./alert-events"),
	maintenanceWindows: () => import("./maintenance-windows"),
	statusPages: () => import("./status-pages"),

	leads: () => import("./leads"),
	trialWatches: () => import("./trial-watches"),
	trialWatchResults: () => import("./trial-watch-results"),
	trialConversions: () => import("./trial-conversions"),
	trialDailyStats: () => import("./trial-daily-stats"),
});

/** The registry bound to one request or job, for code handed `ctx.models`. */
export type UptimeModels = BoundRegistry<typeof models>;
