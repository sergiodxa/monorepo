/**
 * The MCP tools that mirror the authenticated `/api/v1/*` surface: one tool per customer
 * REST capability, named after the path, with OpenAPI body schemas reused as arguments so
 * the model and the API enforce the same contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp/server";

import { ALERT_ID_PARAMS, UPDATE_ALERT_BODY } from "~/app/http/openapi/alerts";
import { CREATE_API_KEY_BODY, API_KEY_ID_PARAMS } from "~/app/http/openapi/api-keys";
import {
	CREATE_CRON_JOB_BODY,
	CRON_JOB_ID_PARAMS,
	UPDATE_CRON_JOB_BODY,
} from "~/app/http/openapi/cron-jobs";
import {
	CREATE_DNS_MONITOR_BODY,
	DNS_MONITOR_ID_PARAMS,
	DNS_MONITOR_RECORD_PARAMS,
	UPDATE_DNS_MONITOR_BODY,
	UPDATE_DNS_MONITOR_RECORD_BODY,
} from "~/app/http/openapi/dns-monitors";
import {
	CREATE_FLOW_MONITOR_BODY,
	FLOW_MONITOR_ID_PARAMS,
	UPDATE_FLOW_MONITOR_BODY,
} from "~/app/http/openapi/flow-monitors";
import {
	CREATE_MAINTENANCE_BODY,
	MAINTENANCE_ID_PARAMS,
	UPDATE_MAINTENANCE_BODY,
} from "~/app/http/openapi/maintenance";
import {
	CONTENT_CHECK_PARAMS,
	CREATE_CONTENT_CHECK_BODY,
	CREATE_MONITOR_BODY,
	MONITOR_ID_PARAMS,
	UPDATE_MONITOR_BODY,
} from "~/app/http/openapi/monitors";
import { REPORT_QUERY } from "~/app/http/openapi/reports";
import {
	CREATE_STATUS_PAGE_BODY,
	STATUS_PAGE_ID_PARAMS,
	UPDATE_ATTACHMENTS_BODY,
	UPDATE_STATUS_PAGE_BODY,
} from "~/app/http/openapi/status-pages";
import {
	CREATE_TCP_MONITOR_BODY,
	TCP_MONITOR_ID_PARAMS,
	UPDATE_TCP_MONITOR_BODY,
} from "~/app/http/openapi/tcp-monitors";
import {
	CREATE_INVITE_BODY,
	CREATE_TEAM_DOMAIN_BODY,
	DELETE_TEAM_DOMAIN_BODY,
	INVITE_ID_PARAMS,
	UPDATE_TEAM_BODY,
} from "~/app/http/openapi/team";
import { MAX_ROUTING_KEY_LENGTH, WEBHOOK_SIGNATURE_SCHEMES } from "~/app/http/validators/alert";
import { deliverableAddress, emailAddress } from "~/app/http/validators/email-address";
import { discordWebhookUrl, slackWebhookUrl } from "~/app/http/validators/webhook-url";
import { flattenInput } from "~/app/mcp/input";
import { PAGE_INPUT } from "~/app/mcp/paging";
import { DEFAULT_COOLDOWN_MINUTES } from "~/app/services/alerts/policy";
import { DNS_RECORD_TYPES } from "~/app/services/dns/record-value";
import { MONITOR_SCOPE_TYPES } from "~/app/services/monitor-scope";
/** Hints for a tool that only reads the caller's own team data. */
const READ = { readOnlyHint: true, openWorldHint: false } as const;

/** Hints for a non-destructive write. */
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

/** Hints for a delete or other irreversible change. */
const DESTROY = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

/** Ad-hoc ping reaches an arbitrary target the caller names. */
const PING_ANN = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

/** Regions an ad-hoc HTTP ping may probe from — same set HTTP monitors use. */
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

/** Methods an ad-hoc HTTP ping may use. */
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;

/**
 * Object form of an HTTP ad-hoc ping. MCP forbids a root `variant`, so the REST body's
 * three arms become three tools instead of one `PING_BODY`.
 */
const PING_HTTP_INPUT = s.object({
	url: s.string().pipe(checks.url()),
	method: s.defaulted(s.enum_(HTTP_METHODS), "GET"),
	expectedStatus: s.defaulted(s.number().pipe(checks.min(100), checks.max(599)), 200),
	timeoutSeconds: s.defaulted(s.number().pipe(checks.min(1), checks.max(60)), 10),
	degradedAfterMs: s.defaulted(s.number().pipe(checks.min(1), checks.max(60_000)), 5000),
	region: s.defaulted(s.enum_(LOCATION_HINTS), "wnam"),
	headers: s.optional(s.record(s.string(), s.string())),
	body: s.optional(s.string().pipe(checks.maxLength(10_000))),
	contentChecks: s.defaulted(
		s.array(
			s.object({
				type: s.enum_(["contains", "not_contains", "regex"]),
				value: s.string().pipe(checks.minLength(1), checks.maxLength(1000)),
				caseSensitive: s.defaulted(s.boolean(), false),
			}),
		),
		[],
	),
});

/** Object form of a DNS ad-hoc ping. */
const PING_DNS_INPUT = s.object({
	domain: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	recordType: s.defaulted(s.enum_(DNS_RECORD_TYPES), "A"),
	expectedValue: s.optional(s.string().pipe(checks.maxLength(1000))),
});

/** Object form of a TCP ad-hoc ping. */
const PING_TCP_INPUT = s.object({
	host: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	port: s.number().pipe(checks.min(1), checks.max(65_535)),
	timeoutMs: s.defaulted(s.number().pipe(checks.min(100), checks.max(60_000)), 5000),
});

/** Shared fields on every create-alert MCP tool. */
const ALERT_COMMON_INPUT = {
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	notifyOnRecovery: s.defaulted(s.boolean(), true),
	cooldownMinutes: s.defaulted(
		s.number().pipe(checks.min(0), checks.max(1440)),
		DEFAULT_COOLDOWN_MINUTES,
	),
	monitorType: s.optional(s.enum_(MONITOR_SCOPE_TYPES)),
	monitorId: s.optional(s.string()),
};

/** `email` strategy create — REST variant arm as a root object. */
const CREATE_EMAIL_ALERT_INPUT = s.object({
	email: s.string().pipe(emailAddress()).transform(deliverableAddress),
	subjectPrefix: s.optional(s.string().pipe(checks.maxLength(100))),
	...ALERT_COMMON_INPUT,
});

/** `webhook` strategy create. */
const CREATE_WEBHOOK_ALERT_INPUT = s.object({
	url: s.string().pipe(checks.url()),
	secret: s.optional(s.string().pipe(checks.maxLength(255))),
	signature: s.defaulted(s.enum_(WEBHOOK_SIGNATURE_SCHEMES), "standard-webhooks"),
	...ALERT_COMMON_INPUT,
});

/** `slack` strategy create. */
const CREATE_SLACK_ALERT_INPUT = s.object({
	webhookUrl: s.string().pipe(slackWebhookUrl()),
	...ALERT_COMMON_INPUT,
});

/** `discord` strategy create. */
const CREATE_DISCORD_ALERT_INPUT = s.object({
	webhookUrl: s.string().pipe(discordWebhookUrl()),
	...ALERT_COMMON_INPUT,
});

/** `pagerduty` strategy create. */
const CREATE_PAGERDUTY_ALERT_INPUT = s.object({
	routingKey: s
		.string()
		.pipe(checks.pattern(/\S/), checks.maxLength(MAX_ROUTING_KEY_LENGTH))
		.transform((value) => value.trim()),
	...ALERT_COMMON_INPUT,
});

/** Daily report filters plus cursor paging (JSON form of GET /reports/uptime-daily). */
const DAILY_REPORT_INPUT = flattenInput(REPORT_QUERY, s.object(PAGE_INPUT));

/**
 * The tools the MCP handler is mapped against, one entry per handler file beside this one.
 */
export default tools({
	getStatus: tool("get_status", {
		title: "Get team status",
		description:
			"Overall operational status across the team's enabled HTTP monitors (operational, degraded, partial_outage, major_outage, or unknown).",
		input: s.object({}),
		annotations: READ,
	}),

	pingHttp: tool("ping_http", {
		title: "Run an ad-hoc HTTP ping",
		description:
			"Runs one throwaway HTTP check against a URL. Billed as one metered ping; stores nothing. Equivalent to POST /api/v1/ping with type http.",
		input: PING_HTTP_INPUT,
		annotations: PING_ANN,
	}),

	pingDns: tool("ping_dns", {
		title: "Run an ad-hoc DNS ping",
		description:
			"Runs one throwaway DNS lookup. Billed as one metered ping; stores nothing. Equivalent to POST /api/v1/ping with type dns.",
		input: PING_DNS_INPUT,
		annotations: PING_ANN,
	}),

	pingTcp: tool("ping_tcp", {
		title: "Run an ad-hoc TCP ping",
		description:
			"Runs one throwaway TCP connect check. Billed as one metered ping; stores nothing. Equivalent to POST /api/v1/ping with type tcp.",
		input: PING_TCP_INPUT,
		annotations: PING_ANN,
	}),

	listMonitors: tool("list_monitors", {
		title: "List HTTP monitors",
		description: "Lists the team's HTTP monitors, newest first.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createMonitor: tool("create_monitor", {
		title: "Create an HTTP monitor",
		description: "Creates an HTTP monitor for the team. Equivalent to POST /api/v1/monitors.",
		input: CREATE_MONITOR_BODY,
		annotations: WRITE,
	}),

	getMonitorsStats: tool("get_monitors_stats", {
		title: "Get aggregate HTTP monitor stats",
		description: "Aggregate stats across every HTTP monitor on the team.",
		input: s.object({}),
		annotations: READ,
	}),

	getMonitor: tool("get_monitor", {
		title: "Get an HTTP monitor",
		description: "Reads one HTTP monitor by id.",
		input: MONITOR_ID_PARAMS,
		annotations: READ,
	}),

	updateMonitor: tool("update_monitor", {
		title: "Update an HTTP monitor",
		description:
			"Updates an HTTP monitor's editable fields (same body as PUT /api/v1/monitors/:monitorId; also covers what PATCH merge-patch would change).",
		input: flattenInput(MONITOR_ID_PARAMS, UPDATE_MONITOR_BODY),
		annotations: WRITE,
	}),

	deleteMonitor: tool("delete_monitor", {
		title: "Delete an HTTP monitor",
		description: "Deletes an HTTP monitor. Requires the monitors:delete scope.",
		input: MONITOR_ID_PARAMS,
		annotations: DESTROY,
	}),

	getMonitorStats: tool("get_monitor_stats", {
		title: "Get one HTTP monitor's stats",
		description: "Aggregate stats for one HTTP monitor.",
		input: MONITOR_ID_PARAMS,
		annotations: READ,
	}),

	listMonitorResults: tool("list_monitor_results", {
		title: "List HTTP monitor check results",
		description: "Paginated check-result history for one HTTP monitor.",
		input: flattenInput(MONITOR_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	listMonitorAlertEvents: tool("list_monitor_alert_events", {
		title: "List alert events for an HTTP monitor",
		description: "Alert-delivery history for one HTTP monitor. Requires alerts:read.",
		input: flattenInput(MONITOR_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	listMonitorContentChecks: tool("list_monitor_content_checks", {
		title: "List content checks",
		description: "Lists content checks on one HTTP monitor.",
		input: flattenInput(MONITOR_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	createMonitorContentCheck: tool("create_monitor_content_check", {
		title: "Create a content check",
		description: "Adds a content check to one HTTP monitor.",
		input: flattenInput(MONITOR_ID_PARAMS, CREATE_CONTENT_CHECK_BODY),
		annotations: WRITE,
	}),

	deleteMonitorContentCheck: tool("delete_monitor_content_check", {
		title: "Delete a content check",
		description: "Deletes one content check from an HTTP monitor.",
		input: CONTENT_CHECK_PARAMS,
		annotations: DESTROY,
	}),

	listDnsMonitors: tool("list_dns_monitors", {
		title: "List DNS monitors",
		description: "Lists the team's DNS monitors, newest first.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createDnsMonitor: tool("create_dns_monitor", {
		title: "Create a DNS monitor",
		description:
			"Creates a DNS monitor, optionally importing records from a zone file paste. Equivalent to POST /api/v1/dns-monitors.",
		input: CREATE_DNS_MONITOR_BODY,
		annotations: WRITE,
	}),

	getDnsMonitor: tool("get_dns_monitor", {
		title: "Get a DNS monitor",
		description: "Reads one DNS monitor by id.",
		input: DNS_MONITOR_ID_PARAMS,
		annotations: READ,
	}),

	updateDnsMonitor: tool("update_dns_monitor", {
		title: "Update a DNS monitor",
		description:
			"Updates a DNS monitor (same body as PUT /api/v1/dns-monitors/:dnsMonitorId). Zone files are not re-imported here.",
		input: flattenInput(DNS_MONITOR_ID_PARAMS, UPDATE_DNS_MONITOR_BODY),
		annotations: WRITE,
	}),

	deleteDnsMonitor: tool("delete_dns_monitor", {
		title: "Delete a DNS monitor",
		description: "Deletes a DNS monitor. Requires the dns-monitors:delete scope.",
		input: DNS_MONITOR_ID_PARAMS,
		annotations: DESTROY,
	}),

	listDnsMonitorResults: tool("list_dns_monitor_results", {
		title: "List DNS monitor results",
		description: "Paginated check-result history for one DNS monitor.",
		input: flattenInput(DNS_MONITOR_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	listDnsMonitorRecords: tool("list_dns_monitor_records", {
		title: "List DNS monitor records",
		description: "Lists tracked DNS records for one DNS monitor, by name.",
		input: flattenInput(DNS_MONITOR_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	updateDnsMonitorRecord: tool("update_dns_monitor_record", {
		title: "Enable or decline a DNS record",
		description:
			"Sets whether a deviation from one tracked DNS record alerts (PATCH /api/v1/dns-monitors/:id/records/:recordId).",
		input: flattenInput(DNS_MONITOR_RECORD_PARAMS, UPDATE_DNS_MONITOR_RECORD_BODY),
		annotations: WRITE,
	}),

	listTcpMonitors: tool("list_tcp_monitors", {
		title: "List TCP monitors",
		description: "Lists the team's TCP monitors, newest first.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createTcpMonitor: tool("create_tcp_monitor", {
		title: "Create a TCP monitor",
		description: "Creates a TCP monitor for the team.",
		input: CREATE_TCP_MONITOR_BODY,
		annotations: WRITE,
	}),

	getTcpMonitor: tool("get_tcp_monitor", {
		title: "Get a TCP monitor",
		description: "Reads one TCP monitor by id.",
		input: TCP_MONITOR_ID_PARAMS,
		annotations: READ,
	}),

	updateTcpMonitor: tool("update_tcp_monitor", {
		title: "Update a TCP monitor",
		description: "Updates a TCP monitor (same body as PUT /api/v1/tcp-monitors/:tcpMonitorId).",
		input: flattenInput(TCP_MONITOR_ID_PARAMS, UPDATE_TCP_MONITOR_BODY),
		annotations: WRITE,
	}),

	deleteTcpMonitor: tool("delete_tcp_monitor", {
		title: "Delete a TCP monitor",
		description: "Deletes a TCP monitor. Requires the tcp-monitors:delete scope.",
		input: TCP_MONITOR_ID_PARAMS,
		annotations: DESTROY,
	}),

	listTcpMonitorResults: tool("list_tcp_monitor_results", {
		title: "List TCP monitor results",
		description: "Paginated check-result history for one TCP monitor.",
		input: flattenInput(TCP_MONITOR_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	listFlowMonitors: tool("list_flow_monitors", {
		title: "List flow monitors",
		description: "Lists the team's browser-flow monitors, newest first.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createFlowMonitor: tool("create_flow_monitor", {
		title: "Create a flow monitor",
		description:
			"Creates a browser-flow monitor. The source URL must be on a verified team domain.",
		input: CREATE_FLOW_MONITOR_BODY,
		annotations: WRITE,
	}),

	getFlowMonitor: tool("get_flow_monitor", {
		title: "Get a flow monitor",
		description: "Reads one flow monitor by id (source is never returned).",
		input: FLOW_MONITOR_ID_PARAMS,
		annotations: READ,
	}),

	updateFlowMonitor: tool("update_flow_monitor", {
		title: "Update a flow monitor",
		description: "Updates a flow monitor (same body as PUT /api/v1/flow-monitors/:flowMonitorId).",
		input: flattenInput(FLOW_MONITOR_ID_PARAMS, UPDATE_FLOW_MONITOR_BODY),
		annotations: WRITE,
	}),

	deleteFlowMonitor: tool("delete_flow_monitor", {
		title: "Delete a flow monitor",
		description: "Deletes a flow monitor. Requires the flow-monitors:delete scope.",
		input: FLOW_MONITOR_ID_PARAMS,
		annotations: DESTROY,
	}),

	listFlowMonitorResults: tool("list_flow_monitor_results", {
		title: "List flow monitor results",
		description: "Paginated check-result history for one flow monitor.",
		input: flattenInput(FLOW_MONITOR_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	listCronJobs: tool("list_cron_jobs", {
		title: "List cron jobs",
		description: "Lists the team's cron-job monitors, newest first.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createCronJob: tool("create_cron_job", {
		title: "Create a cron job",
		description: "Creates a cron-job monitor. The cron expression is stored normalized.",
		input: CREATE_CRON_JOB_BODY,
		annotations: WRITE,
	}),

	getCronJob: tool("get_cron_job", {
		title: "Get a cron job",
		description: "Reads one cron-job monitor by id.",
		input: CRON_JOB_ID_PARAMS,
		annotations: READ,
	}),

	updateCronJob: tool("update_cron_job", {
		title: "Update a cron job",
		description: "Updates a cron-job monitor (same body as PUT /api/v1/cron-jobs/:cronJobId).",
		input: flattenInput(CRON_JOB_ID_PARAMS, UPDATE_CRON_JOB_BODY),
		annotations: WRITE,
	}),

	deleteCronJob: tool("delete_cron_job", {
		title: "Delete a cron job",
		description: "Deletes a cron-job monitor. Requires the cron-jobs:delete scope.",
		input: CRON_JOB_ID_PARAMS,
		annotations: DESTROY,
	}),

	listAlerts: tool("list_alerts", {
		title: "List alerts",
		description: "Lists the team's alerts with sensitive channel config stripped.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createEmailAlert: tool("create_email_alert", {
		title: "Create an email alert",
		description: "Creates an email alert. Equivalent to POST /api/v1/alerts with strategy email.",
		input: CREATE_EMAIL_ALERT_INPUT,
		annotations: WRITE,
	}),

	createWebhookAlert: tool("create_webhook_alert", {
		title: "Create a webhook alert",
		description:
			"Creates a webhook alert. Equivalent to POST /api/v1/alerts with strategy webhook.",
		input: CREATE_WEBHOOK_ALERT_INPUT,
		annotations: WRITE,
	}),

	createSlackAlert: tool("create_slack_alert", {
		title: "Create a Slack alert",
		description:
			"Creates a Slack incoming-webhook alert. Equivalent to POST /api/v1/alerts with strategy slack.",
		input: CREATE_SLACK_ALERT_INPUT,
		annotations: WRITE,
	}),

	createDiscordAlert: tool("create_discord_alert", {
		title: "Create a Discord alert",
		description:
			"Creates a Discord webhook alert. Equivalent to POST /api/v1/alerts with strategy discord.",
		input: CREATE_DISCORD_ALERT_INPUT,
		annotations: WRITE,
	}),

	createPagerdutyAlert: tool("create_pagerduty_alert", {
		title: "Create a PagerDuty alert",
		description:
			"Creates a PagerDuty Events API v2 alert. Equivalent to POST /api/v1/alerts with strategy pagerduty.",
		input: CREATE_PAGERDUTY_ALERT_INPUT,
		annotations: WRITE,
	}),

	getAlert: tool("get_alert", {
		title: "Get an alert",
		description: "Reads one alert with sensitive channel config stripped.",
		input: ALERT_ID_PARAMS,
		annotations: READ,
	}),

	updateAlert: tool("update_alert", {
		title: "Update an alert",
		description:
			"Updates an alert's non-channel fields (same body as PUT /api/v1/alerts/:alertId). The channel strategy is fixed at creation.",
		input: flattenInput(ALERT_ID_PARAMS, UPDATE_ALERT_BODY),
		annotations: WRITE,
	}),

	deleteAlert: tool("delete_alert", {
		title: "Delete an alert",
		description: "Deletes an alert. Requires alerts:write.",
		input: ALERT_ID_PARAMS,
		annotations: DESTROY,
	}),

	listAlertEvents: tool("list_alert_events", {
		title: "List alert delivery events",
		description: "Delivery-event history for one alert.",
		input: flattenInput(ALERT_ID_PARAMS, s.object(PAGE_INPUT)),
		annotations: READ,
	}),

	listMaintenance: tool("list_maintenance", {
		title: "List maintenance windows",
		description: "Lists the team's maintenance windows, newest first.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createMaintenance: tool("create_maintenance", {
		title: "Create a maintenance window",
		description: "Creates a maintenance window for the team.",
		input: CREATE_MAINTENANCE_BODY,
		annotations: WRITE,
	}),

	getMaintenance: tool("get_maintenance", {
		title: "Get a maintenance window",
		description: "Reads one maintenance window by id.",
		input: MAINTENANCE_ID_PARAMS,
		annotations: READ,
	}),

	updateMaintenance: tool("update_maintenance", {
		title: "Update a maintenance window",
		description:
			"Updates a maintenance window (same body as PUT /api/v1/maintenance/:maintenanceId).",
		input: flattenInput(MAINTENANCE_ID_PARAMS, UPDATE_MAINTENANCE_BODY),
		annotations: WRITE,
	}),

	deleteMaintenance: tool("delete_maintenance", {
		title: "Delete a maintenance window",
		description: "Deletes a maintenance window. Requires maintenance:write.",
		input: MAINTENANCE_ID_PARAMS,
		annotations: DESTROY,
	}),

	endMaintenance: tool("end_maintenance", {
		title: "End a maintenance window early",
		description: "Ends a maintenance window early. Equivalent to POST /api/v1/maintenance/:id/end.",
		input: MAINTENANCE_ID_PARAMS,
		annotations: WRITE,
	}),

	listStatusPages: tool("list_status_pages", {
		title: "List status pages",
		description: "Lists the team's status pages, newest first.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createStatusPage: tool("create_status_page", {
		title: "Create a status page",
		description: "Creates a status page for the team.",
		input: CREATE_STATUS_PAGE_BODY,
		annotations: WRITE,
	}),

	getStatusPage: tool("get_status_page", {
		title: "Get a status page",
		description: "Reads one status page with its attached monitor and cron-job id lists.",
		input: STATUS_PAGE_ID_PARAMS,
		annotations: READ,
	}),

	updateStatusPage: tool("update_status_page", {
		title: "Update a status page",
		description:
			"Updates a status page's own fields (same body as PUT /api/v1/status-pages/:statusPageId).",
		input: flattenInput(STATUS_PAGE_ID_PARAMS, UPDATE_STATUS_PAGE_BODY),
		annotations: WRITE,
	}),

	deleteStatusPage: tool("delete_status_page", {
		title: "Delete a status page",
		description: "Deletes a status page and its attachments. Requires status-pages:write.",
		input: STATUS_PAGE_ID_PARAMS,
		annotations: DESTROY,
	}),

	updateStatusPageMonitors: tool("update_status_page_monitors", {
		title: "Replace status page attachments",
		description:
			"Replaces the HTTP monitors and cron jobs attached to a status page. Equivalent to PUT /api/v1/status-pages/:id/monitors.",
		input: flattenInput(STATUS_PAGE_ID_PARAMS, UPDATE_ATTACHMENTS_BODY),
		annotations: WRITE,
	}),

	getUptimeSummary: tool("get_uptime_summary", {
		title: "Uptime summary report",
		description:
			"Per-monitor uptime summary over a UTC day range (defaults to last month). Equivalent to GET /api/v1/reports/uptime-summary (JSON).",
		input: REPORT_QUERY,
		annotations: READ,
	}),

	getUptimeDaily: tool("get_uptime_daily", {
		title: "Uptime daily report",
		description:
			"Daily uptime rows over a UTC day range, paged. Equivalent to GET /api/v1/reports/uptime-daily (JSON).",
		input: DAILY_REPORT_INPUT,
		annotations: READ,
	}),

	getTeam: tool("get_team", {
		title: "Get the team",
		description: "Reads the authenticated team's profile.",
		input: s.object({}),
		annotations: READ,
	}),

	updateTeam: tool("update_team", {
		title: "Update the team",
		description:
			"Updates the team's name and/or logo URL (same body as PUT /api/v1/team; at least one field required).",
		input: UPDATE_TEAM_BODY,
		annotations: WRITE,
	}),

	listMemberships: tool("list_memberships", {
		title: "List memberships",
		description: "Lists the team's memberships.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	listInvites: tool("list_invites", {
		title: "List invites",
		description: "Lists every invite (pending and accepted) for the team.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createInvite: tool("create_invite", {
		title: "Create an invite",
		description: "Creates a pending invite for the team.",
		input: CREATE_INVITE_BODY,
		annotations: WRITE,
	}),

	deleteInvite: tool("delete_invite", {
		title: "Delete an invite",
		description: "Deletes an invite. Requires invites:write.",
		input: INVITE_ID_PARAMS,
		annotations: DESTROY,
	}),

	listTeamDomains: tool("list_team_domains", {
		title: "List team domains",
		description: "Lists the team's domains.",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createTeamDomain: tool("create_team_domain", {
		title: "Add a team domain",
		description: "Adds a domain for the team, pending verification.",
		input: CREATE_TEAM_DOMAIN_BODY,
		annotations: WRITE,
	}),

	deleteTeamDomain: tool("delete_team_domain", {
		title: "Remove a team domain",
		description: "Removes a domain by id (same body as DELETE /api/v1/team-domains).",
		input: DELETE_TEAM_DOMAIN_BODY,
		annotations: DESTROY,
	}),

	listApiKeys: tool("list_api_keys", {
		title: "List API keys",
		description: "Lists the team's API keys (metadata only; plaintext keys are never listed).",
		input: s.object(PAGE_INPUT),
		annotations: READ,
	}),

	createApiKey: tool("create_api_key", {
		title: "Create an API key",
		description:
			"Creates an API key. The plaintext key is returned once. Scopes must be a subset of the calling key's scopes.",
		input: CREATE_API_KEY_BODY,
		annotations: WRITE,
	}),

	deleteApiKey: tool("delete_api_key", {
		title: "Delete an API key",
		description: "Deletes an API key. Requires api-keys:write.",
		input: API_KEY_ID_PARAMS,
		annotations: DESTROY,
	}),
});
