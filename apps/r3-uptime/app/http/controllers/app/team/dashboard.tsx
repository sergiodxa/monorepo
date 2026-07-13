/**
 * Team dashboard controller. Resolves the selected monitor-type tab (query param,
 * falling back to the persisted cookie, then "http"), loads the overview stat cards
 * (HTTP uptime/latency from Analytics Engine, DNS/TCP/cron-job/SSL counts from the
 * database, and Polar ping usage), and persists the resolved tab back to the cookie
 * so a later visit without `?tab=` remembers it. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";
import { css } from "remix/ui";

import type { DashboardTab, PingUsage } from "~/resources/views/dashboard";

import CronJobMonitor from "~/app/data/cron-job";
import Customer from "~/app/data/customer";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { dashboardTab as dashboardTabCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import DashboardView from "~/resources/views/dashboard";
import routes from "~/routes/web";

const DASHBOARD_TABS: readonly DashboardTab[] = ["http", "dns", "tcp", "cron-jobs"];

function isDashboardTab(value: string | null): value is DashboardTab {
	return value !== null && (DASHBOARD_TABS as readonly string[]).includes(value);
}

interface Toast {
	intent: "success" | "error";
	message: string;
}

/**
 * Fetches the team's Polar ping usage for the current month alongside the
 * estimated consumption its current monitor settings project, for the dashboard's
 * usage card. Returns `null` — rendered as an error/empty state by the view — when
 * the team's owner has no active subscription or the Polar request fails, since
 * "usage unavailable" must never be shown to the user as "0 used".
 */
async function getPingUsage(
	db: Database,
	polar: PolarClient,
	team: { id: string; owner_id: string },
) {
	let hasActiveSubscription = await Customer.hasActiveSubscription(polar, team.owner_id);
	if (!hasActiveSubscription) return null;

	try {
		let now = new Date();
		let [consumed, estimated] = await Promise.all([
			Customer.getUsagePerMonth(polar, team.owner_id, team.id, now),
			Monitor.estimateConsumedPingsByTeam(db, team.id, now),
		]);
		return { consumed, estimated } satisfies PingUsage;
	} catch {
		return null;
	}
}

/** GET /app/:team/dashboard — the team's dashboard shell. */
export default createAction(routes.app.team.dashboard, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database, PolarClient] as const, async (db, polar) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let cookieTab = await dashboardTabCookie.parse(ctx.request.headers.get("Cookie"));
		let queryTab = ctx.url.searchParams.get("tab");
		let tab: DashboardTab = isDashboardTab(queryTab)
			? queryTab
			: isDashboardTab(cookieTab)
				? cookieTab
				: "http";

		let toast = ctx.get(Session)?.get("toast") as Toast | undefined;

		let [monitors, dnsMonitors, tcpMonitors, cronJobMonitors, summaries, pingUsage] =
			await Promise.all([
				Monitor.listByTeam(db, ctx.team.id),
				DnsMonitor.listByTeam(db, ctx.team.id),
				TcpMonitor.listByTeam(db, ctx.team.id),
				CronJobMonitor.listByTeam(db, ctx.team.id),
				getTeamHttpSummaries(ctx.team.id),
				getPingUsage(db, polar, ctx.team),
			]);

		let analyticsUnavailable = isFailure(summaries);
		let summaryList = isFailure(summaries) ? [] : summaries.data;

		let totalChecks = summaryList.reduce((sum, summary) => sum + summary.totalChecks, 0);
		let successfulChecks = summaryList.reduce((sum, summary) => sum + summary.successfulChecks, 0);
		let uptimePercent = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 100) : null;

		let slowestSummary = summaryList.reduce<(typeof summaryList)[number] | null>(
			(slowest, summary) => {
				if (!slowest || summary.maxResponseTimeMs > slowest.maxResponseTimeMs) return summary;
				return slowest;
			},
			null,
		);
		let slowestResponseMs = slowestSummary?.maxResponseTimeMs ?? null;
		let slowestMonitorName =
			(slowestSummary &&
				monitors.find((monitor) => monitor.id === slowestSummary.monitorId)?.name) ??
			null;

		let httpCounts = {
			up: summaryList.filter((summary) => summary.health === "up").length,
			down: summaryList.filter((summary) => summary.health === "down").length,
		};

		let dnsCounts = {
			ok: dnsMonitors.filter((monitor) => monitor.last_status === "ok").length,
			changed: dnsMonitors.filter((monitor) => monitor.last_status === "changed").length,
			error: dnsMonitors.filter((monitor) => monitor.last_status === "error").length,
		};

		let tcpCounts = {
			up: tcpMonitors.filter((monitor) => monitor.last_status === "up").length,
			down: tcpMonitors.filter(
				(monitor) => monitor.last_status === "down" || monitor.last_status === "timeout",
			).length,
		};

		let cronCounts = {
			healthy: cronJobMonitors.filter((monitor) => monitor.status === "healthy").length,
			late: cronJobMonitors.filter((monitor) => monitor.status === "late").length,
			missed: cronJobMonitors.filter((monitor) => monitor.status === "missed").length,
		};

		let sslMonitors = monitors.filter((monitor) => monitor.ssl_monitoring_enabled);
		let sslCounts = {
			valid: sslMonitors.filter((monitor) => monitor.ssl_status === "valid").length,
			expiring: sslMonitors.filter((monitor) => monitor.ssl_status === "expiring").length,
			expired: sslMonitors.filter((monitor) => monitor.ssl_status === "expired").length,
		};

		let headers = new Headers();
		headers.set("Set-Cookie", await dashboardTabCookie.serialize(tab));

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Dashboard`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb="Dashboard"
					actions={
						<a
							href={routes.app.team.monitorNew.href({ team: ctx.team.slug })}
							mix={[
								css({
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									padding: "8px 16px",
									borderRadius: 6,
									border: "1px solid transparent",
									background: "oklch(0.24 0.005 145)",
									color: "#ffffff",
									fontFamily: "inherit",
									fontSize: "0.875rem",
									fontWeight: 500,
									cursor: "pointer",
									textDecoration: "none",
									"&:hover": { background: "oklch(0.32 0.006 145)" },
								}),
							]}
						>
							Create monitor
						</a>
					}
					toast={toast}
				>
					<DashboardView
						team={ctx.team}
						tab={tab}
						pingUsage={pingUsage}
						uptimePercent={uptimePercent}
						slowestResponseMs={slowestResponseMs}
						slowestMonitorName={slowestMonitorName}
						httpCounts={{ total: monitors.length, ...httpCounts }}
						dnsCounts={{ total: dnsMonitors.length, ...dnsCounts }}
						tcpCounts={{ total: tcpMonitors.length, ...tcpCounts }}
						cronCounts={{ total: cronJobMonitors.length, ...cronCounts }}
						sslCounts={{ total: sslMonitors.length, ...sslCounts }}
						analyticsUnavailable={analyticsUnavailable}
					/>
				</AppShell>
			</DocumentLayout>,
			{ headers },
		);
	}),
});
