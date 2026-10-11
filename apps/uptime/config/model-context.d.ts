/**
 * What uptime's model callbacks read besides the database: the rest of the registry, bound to
 * the same request or job, and the enqueuer a write's `afterCommit` sends its follow-up jobs
 * through, so a job goes out only for a write that was kept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BoundModels } from "@sdxc/data-model";
import type { JobEnqueuer } from "@sdxc/jobs";

import type { AccountDeletions } from "~/app/models/account-deletions";
import type { AlertEvents } from "~/app/models/alert-events";
import type { Alerts } from "~/app/models/alerts";
import type { ApiKeys } from "~/app/models/api-keys";
import type { BillingWebhookDeliveries } from "~/app/models/billing-webhook-deliveries";
import type { ContentChecks } from "~/app/models/content-checks";
import type { CronJobMonitors } from "~/app/models/cron-job-monitors";
import type { CronJobPings } from "~/app/models/cron-job-pings";
import type { DnsMonitorRecords } from "~/app/models/dns-monitor-records";
import type { DnsMonitorResults } from "~/app/models/dns-monitor-results";
import type { DnsMonitors } from "~/app/models/dns-monitors";
import type { FlowMonitorResults } from "~/app/models/flow-monitor-results";
import type { FlowMonitors } from "~/app/models/flow-monitors";
import type { Invites } from "~/app/models/invites";
import type { Leads } from "~/app/models/leads";
import type { MaintenanceWindows } from "~/app/models/maintenance-windows";
import type { Memberships } from "~/app/models/memberships";
import type { MonitorDailyStats } from "~/app/models/monitor-daily-stats";
import type { MonitorResults } from "~/app/models/monitor-results";
import type { Monitors } from "~/app/models/monitors";
import type { StatusPages } from "~/app/models/status-pages";
import type { Subscriptions } from "~/app/models/subscriptions";
import type { TcpMonitorResults } from "~/app/models/tcp-monitor-results";
import type { TcpMonitors } from "~/app/models/tcp-monitors";
import type { TeamDomains } from "~/app/models/team-domains";
import type { Teams } from "~/app/models/teams";
import type { TrialConversions } from "~/app/models/trial-conversions";
import type { TrialDailyStats } from "~/app/models/trial-daily-stats";
import type { TrialWatchResults } from "~/app/models/trial-watch-results";
import type { TrialWatches } from "~/app/models/trial-watches";
import type { UserPreferences } from "~/app/models/user-preferences";

/** The registry's entries, so a model method reaches its siblings through `this.context.models`. */
interface UptimeModelEntries {
	accountDeletions: typeof AccountDeletions;
	apiKeys: typeof ApiKeys;
	billingWebhookDeliveries: typeof BillingWebhookDeliveries;
	invites: typeof Invites;
	memberships: typeof Memberships;
	subscriptions: typeof Subscriptions;
	teamDomains: typeof TeamDomains;
	teams: typeof Teams;
	userPreferences: typeof UserPreferences;
	contentChecks: typeof ContentChecks;
	monitorDailyStats: typeof MonitorDailyStats;
	monitorResults: typeof MonitorResults;
	monitors: typeof Monitors;
	dnsMonitors: typeof DnsMonitors;
	dnsMonitorRecords: typeof DnsMonitorRecords;
	dnsMonitorResults: typeof DnsMonitorResults;
	tcpMonitors: typeof TcpMonitors;
	tcpMonitorResults: typeof TcpMonitorResults;
	flowMonitors: typeof FlowMonitors;
	flowMonitorResults: typeof FlowMonitorResults;
	cronJobMonitors: typeof CronJobMonitors;
	cronJobPings: typeof CronJobPings;
	alerts: typeof Alerts;
	alertEvents: typeof AlertEvents;
	maintenanceWindows: typeof MaintenanceWindows;
	statusPages: typeof StatusPages;
	leads: typeof Leads;
	trialWatches: typeof TrialWatches;
	trialWatchResults: typeof TrialWatchResults;
	trialConversions: typeof TrialConversions;
	trialDailyStats: typeof TrialDailyStats;
}

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Every model, bound to the same database and unit of work as the one calling. */
		models: BoundModels<UptimeModelEntries>;
		/** The request's `ctx.jobs`, or the module enqueuer where no request is running. */
		jobs: JobEnqueuer;
	}
}

export {};
