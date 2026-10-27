/**
 * Assembles the Uptime MCP server: binds every declared tool to its handler and exposes
 * one `fetch` for the router to mount behind API-key auth and the `mcp` scope gate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ToolMiddleware } from "@sdxc/mcp";

import { currentLog } from "@sdxc/logger";
import { createHandler, lazy } from "@sdxc/mcp";

import toolset from "~/app/mcp/tools";

/**
 * How long a client may cache the tool list. A minute, because the list varies by the
 * key's scopes — a monitors:read key never sees a write tool — so what is cached is this
 * caller's view of them.
 */
const LIST_TTL_MS = 60_000;

/**
 * Records which tool ran, how long it took, and whether it failed, without logging the
 * arguments or the team's data the answer carried.
 */
function recordToolCall(): ToolMiddleware {
	return async (ctx, next) => {
		let started = Date.now();
		let result = await next();

		currentLog()?.note("mcp.tool", {
			tool: ctx.tool.name,
			durationMs: Date.now() - started,
			isError: result.isError === true,
		});

		return result;
	};
}

/**
 * The Uptime MCP server. Built once at module scope: mapping is pure object construction,
 * complete before any request arrives.
 */
const mcp = createHandler({
	name: "uptime",
	title: "Uptime",
	version: "1.0.0",
	instructions:
		"Operate one team's uptime monitoring through the same capabilities as the REST API. Every tool needs the matching API scope on the key in addition to `mcp`. Prefer list_* before mutating; ids are typed prefixes such as mon_…, dns_…, tcp_…, flo_…, cron_…, alt_…, mtn_…, spg_…, key_….",
	listTtlMs: LIST_TTL_MS,
	toolMiddleware: [recordToolCall()],
	onError: (error, context) => {
		currentLog()?.warn("mcp.failed", {
			method: context.method,
			tool: context.tool ?? null,
			message: error instanceof Error ? error.message : "unknown",
		});
	},
});

mcp.tools.map(
	toolset.getStatus,
	lazy(() => import("~/app/mcp/tools/get-status")),
);
mcp.tools.map(
	toolset.pingHttp,
	lazy(() => import("~/app/mcp/tools/ping-http")),
);
mcp.tools.map(
	toolset.pingDns,
	lazy(() => import("~/app/mcp/tools/ping-dns")),
);
mcp.tools.map(
	toolset.pingTcp,
	lazy(() => import("~/app/mcp/tools/ping-tcp")),
);
mcp.tools.map(
	toolset.listMonitors,
	lazy(() => import("~/app/mcp/tools/list-monitors")),
);
mcp.tools.map(
	toolset.createMonitor,
	lazy(() => import("~/app/mcp/tools/create-monitor")),
);
mcp.tools.map(
	toolset.getMonitorsStats,
	lazy(() => import("~/app/mcp/tools/get-monitors-stats")),
);
mcp.tools.map(
	toolset.getMonitor,
	lazy(() => import("~/app/mcp/tools/get-monitor")),
);
mcp.tools.map(
	toolset.updateMonitor,
	lazy(() => import("~/app/mcp/tools/update-monitor")),
);
mcp.tools.map(
	toolset.deleteMonitor,
	lazy(() => import("~/app/mcp/tools/delete-monitor")),
);
mcp.tools.map(
	toolset.getMonitorStats,
	lazy(() => import("~/app/mcp/tools/get-monitor-stats")),
);
mcp.tools.map(
	toolset.listMonitorResults,
	lazy(() => import("~/app/mcp/tools/list-monitor-results")),
);
mcp.tools.map(
	toolset.listMonitorAlertEvents,
	lazy(() => import("~/app/mcp/tools/list-monitor-alert-events")),
);
mcp.tools.map(
	toolset.listMonitorContentChecks,
	lazy(() => import("~/app/mcp/tools/list-monitor-content-checks")),
);
mcp.tools.map(
	toolset.createMonitorContentCheck,
	lazy(() => import("~/app/mcp/tools/create-monitor-content-check")),
);
mcp.tools.map(
	toolset.deleteMonitorContentCheck,
	lazy(() => import("~/app/mcp/tools/delete-monitor-content-check")),
);
mcp.tools.map(
	toolset.listDnsMonitors,
	lazy(() => import("~/app/mcp/tools/list-dns-monitors")),
);
mcp.tools.map(
	toolset.createDnsMonitor,
	lazy(() => import("~/app/mcp/tools/create-dns-monitor")),
);
mcp.tools.map(
	toolset.getDnsMonitor,
	lazy(() => import("~/app/mcp/tools/get-dns-monitor")),
);
mcp.tools.map(
	toolset.updateDnsMonitor,
	lazy(() => import("~/app/mcp/tools/update-dns-monitor")),
);
mcp.tools.map(
	toolset.deleteDnsMonitor,
	lazy(() => import("~/app/mcp/tools/delete-dns-monitor")),
);
mcp.tools.map(
	toolset.listDnsMonitorResults,
	lazy(() => import("~/app/mcp/tools/list-dns-monitor-results")),
);
mcp.tools.map(
	toolset.listDnsMonitorRecords,
	lazy(() => import("~/app/mcp/tools/list-dns-monitor-records")),
);
mcp.tools.map(
	toolset.updateDnsMonitorRecord,
	lazy(() => import("~/app/mcp/tools/update-dns-monitor-record")),
);
mcp.tools.map(
	toolset.listTcpMonitors,
	lazy(() => import("~/app/mcp/tools/list-tcp-monitors")),
);
mcp.tools.map(
	toolset.createTcpMonitor,
	lazy(() => import("~/app/mcp/tools/create-tcp-monitor")),
);
mcp.tools.map(
	toolset.getTcpMonitor,
	lazy(() => import("~/app/mcp/tools/get-tcp-monitor")),
);
mcp.tools.map(
	toolset.updateTcpMonitor,
	lazy(() => import("~/app/mcp/tools/update-tcp-monitor")),
);
mcp.tools.map(
	toolset.deleteTcpMonitor,
	lazy(() => import("~/app/mcp/tools/delete-tcp-monitor")),
);
mcp.tools.map(
	toolset.listTcpMonitorResults,
	lazy(() => import("~/app/mcp/tools/list-tcp-monitor-results")),
);
mcp.tools.map(
	toolset.listFlowMonitors,
	lazy(() => import("~/app/mcp/tools/list-flow-monitors")),
);
mcp.tools.map(
	toolset.createFlowMonitor,
	lazy(() => import("~/app/mcp/tools/create-flow-monitor")),
);
mcp.tools.map(
	toolset.getFlowMonitor,
	lazy(() => import("~/app/mcp/tools/get-flow-monitor")),
);
mcp.tools.map(
	toolset.updateFlowMonitor,
	lazy(() => import("~/app/mcp/tools/update-flow-monitor")),
);
mcp.tools.map(
	toolset.deleteFlowMonitor,
	lazy(() => import("~/app/mcp/tools/delete-flow-monitor")),
);
mcp.tools.map(
	toolset.listFlowMonitorResults,
	lazy(() => import("~/app/mcp/tools/list-flow-monitor-results")),
);
mcp.tools.map(
	toolset.listCronJobs,
	lazy(() => import("~/app/mcp/tools/list-cron-jobs")),
);
mcp.tools.map(
	toolset.createCronJob,
	lazy(() => import("~/app/mcp/tools/create-cron-job")),
);
mcp.tools.map(
	toolset.getCronJob,
	lazy(() => import("~/app/mcp/tools/get-cron-job")),
);
mcp.tools.map(
	toolset.updateCronJob,
	lazy(() => import("~/app/mcp/tools/update-cron-job")),
);
mcp.tools.map(
	toolset.deleteCronJob,
	lazy(() => import("~/app/mcp/tools/delete-cron-job")),
);
mcp.tools.map(
	toolset.listAlerts,
	lazy(() => import("~/app/mcp/tools/list-alerts")),
);
mcp.tools.map(
	toolset.createEmailAlert,
	lazy(() => import("~/app/mcp/tools/create-email-alert")),
);
mcp.tools.map(
	toolset.createWebhookAlert,
	lazy(() => import("~/app/mcp/tools/create-webhook-alert")),
);
mcp.tools.map(
	toolset.createSlackAlert,
	lazy(() => import("~/app/mcp/tools/create-slack-alert")),
);
mcp.tools.map(
	toolset.createDiscordAlert,
	lazy(() => import("~/app/mcp/tools/create-discord-alert")),
);
mcp.tools.map(
	toolset.createPagerdutyAlert,
	lazy(() => import("~/app/mcp/tools/create-pagerduty-alert")),
);
mcp.tools.map(
	toolset.getAlert,
	lazy(() => import("~/app/mcp/tools/get-alert")),
);
mcp.tools.map(
	toolset.updateAlert,
	lazy(() => import("~/app/mcp/tools/update-alert")),
);
mcp.tools.map(
	toolset.deleteAlert,
	lazy(() => import("~/app/mcp/tools/delete-alert")),
);
mcp.tools.map(
	toolset.listAlertEvents,
	lazy(() => import("~/app/mcp/tools/list-alert-events")),
);
mcp.tools.map(
	toolset.listMaintenance,
	lazy(() => import("~/app/mcp/tools/list-maintenance")),
);
mcp.tools.map(
	toolset.createMaintenance,
	lazy(() => import("~/app/mcp/tools/create-maintenance")),
);
mcp.tools.map(
	toolset.getMaintenance,
	lazy(() => import("~/app/mcp/tools/get-maintenance")),
);
mcp.tools.map(
	toolset.updateMaintenance,
	lazy(() => import("~/app/mcp/tools/update-maintenance")),
);
mcp.tools.map(
	toolset.deleteMaintenance,
	lazy(() => import("~/app/mcp/tools/delete-maintenance")),
);
mcp.tools.map(
	toolset.endMaintenance,
	lazy(() => import("~/app/mcp/tools/end-maintenance")),
);
mcp.tools.map(
	toolset.listStatusPages,
	lazy(() => import("~/app/mcp/tools/list-status-pages")),
);
mcp.tools.map(
	toolset.createStatusPage,
	lazy(() => import("~/app/mcp/tools/create-status-page")),
);
mcp.tools.map(
	toolset.getStatusPage,
	lazy(() => import("~/app/mcp/tools/get-status-page")),
);
mcp.tools.map(
	toolset.updateStatusPage,
	lazy(() => import("~/app/mcp/tools/update-status-page")),
);
mcp.tools.map(
	toolset.deleteStatusPage,
	lazy(() => import("~/app/mcp/tools/delete-status-page")),
);
mcp.tools.map(
	toolset.updateStatusPageMonitors,
	lazy(() => import("~/app/mcp/tools/update-status-page-monitors")),
);
mcp.tools.map(
	toolset.getUptimeSummary,
	lazy(() => import("~/app/mcp/tools/get-uptime-summary")),
);
mcp.tools.map(
	toolset.getUptimeDaily,
	lazy(() => import("~/app/mcp/tools/get-uptime-daily")),
);
mcp.tools.map(
	toolset.getTeam,
	lazy(() => import("~/app/mcp/tools/get-team")),
);
mcp.tools.map(
	toolset.updateTeam,
	lazy(() => import("~/app/mcp/tools/update-team")),
);
mcp.tools.map(
	toolset.listMemberships,
	lazy(() => import("~/app/mcp/tools/list-memberships")),
);
mcp.tools.map(
	toolset.listInvites,
	lazy(() => import("~/app/mcp/tools/list-invites")),
);
mcp.tools.map(
	toolset.createInvite,
	lazy(() => import("~/app/mcp/tools/create-invite")),
);
mcp.tools.map(
	toolset.deleteInvite,
	lazy(() => import("~/app/mcp/tools/delete-invite")),
);
mcp.tools.map(
	toolset.listTeamDomains,
	lazy(() => import("~/app/mcp/tools/list-team-domains")),
);
mcp.tools.map(
	toolset.createTeamDomain,
	lazy(() => import("~/app/mcp/tools/create-team-domain")),
);
mcp.tools.map(
	toolset.deleteTeamDomain,
	lazy(() => import("~/app/mcp/tools/delete-team-domain")),
);
mcp.tools.map(
	toolset.listApiKeys,
	lazy(() => import("~/app/mcp/tools/list-api-keys")),
);
mcp.tools.map(
	toolset.createApiKey,
	lazy(() => import("~/app/mcp/tools/create-api-key")),
);
mcp.tools.map(
	toolset.deleteApiKey,
	lazy(() => import("~/app/mcp/tools/delete-api-key")),
);

export default mcp;
