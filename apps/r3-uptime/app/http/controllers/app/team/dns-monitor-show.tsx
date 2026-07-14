/**
 * DNS monitor detail page controller. Shows the monitor's configuration, stats
 * derived from its result history, and the history itself. Requires `requireUser` +
 * `requireTeam`; 404s when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon, PlayIcon, RefreshCwIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import DnsMonitor from "~/app/data/dns-monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import Button from "~/resources/components/button";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import StatCard from "~/resources/components/stat-card";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
};

/** GET /app/:team/dns/:monitorId — a DNS monitor's detail page. */
export default createAction(routes.app.team.dnsMonitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await DnsMonitor.listResults(db, monitor.id);
		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "dns");

		let totalChecks = results.length;
		let okChecks = results.filter((result) => result.status === "ok").length;
		let successRate = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : null;
		let timedResults = results.filter((result) => result.response_time_ms !== null);
		let avgResponseTime =
			timedResults.length > 0
				? Math.round(
						timedResults.reduce((sum, result) => sum + (result.response_time_ms ?? 0), 0) /
							timedResults.length,
					)
				: null;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.dnsMonitorDetail.header.title", { name: monitor.name })}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.monitor.dns.check.href({ team: ctx.team.slug })}
								mix={[css({ margin: 0 })]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<Button type="submit">
									<PlayIcon size={16} strokeWidth={1.5} />
									{ctx.i18next.t("page.dnsMonitorDetail.header.action.check")}
								</Button>
							</form>
							<LinkButton
								href={routes.app.team.dnsMonitors.show.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<RefreshCwIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.dnsMonitorDetail.header.action.refresh")}
							</LinkButton>
							<LinkButton
								href={routes.app.team.dnsMonitors.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.dnsMonitorDetail.header.action.edit")}
							</LinkButton>
						</div>
					}
				>
					<div>
						<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.domain")}
								value={<code>{monitor.domain}</code>}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.recordType")}
								value={monitor.record_type}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.status")}
								value={
									<Badge tone={STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral"}>
										{monitor.last_status ?? "not checked"}
									</Badge>
								}
							/>
							{monitor.expected_value && (
								<StatCard
									label={ctx.i18next.t("page.dnsMonitorDetail.info.expectedValue")}
									value={<code>{monitor.expected_value}</code>}
								/>
							)}
							{monitor.last_value && (
								<StatCard
									label={ctx.i18next.t("page.dnsMonitorDetail.info.currentValue")}
									value={<code>{monitor.last_value}</code>}
								/>
							)}
						</div>

						<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.stats.successRate.label")}
								value={successRate === null ? "—" : `${successRate}%`}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.stats.avgResponseTime.label")}
								value={avgResponseTime === null ? "—" : `${avgResponseTime}ms`}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.stats.totalChecks.label")}
								value={totalChecks}
							/>
						</div>

						<h2>Uptime history</h2>
						<Heatmap days={dailyStats} />

						<h2>{ctx.i18next.t("page.dnsMonitorDetail.results.title")}</h2>
						{results.length === 0 ? (
							<Empty>
								<Empty.Description>
									{ctx.i18next.t("page.dnsMonitorDetail.results.empty")}
								</Empty.Description>
							</Empty>
						) : (
							<div mix={[css({ overflowX: "auto" })]}>
								<table
									mix={[
										css({
											width: "100%",
											borderCollapse: "collapse",
											fontSize: "0.875rem",
											"& th, & td": {
												textAlign: "left",
												padding: "12px 16px",
												borderBottom: `1px solid ${neutral[200]}`,
											},
											"@media (prefers-color-scheme: dark)": {
												"& th, & td": { borderColor: neutral[800] },
											},
										}),
									]}
								>
									<thead>
										<tr>
											<th>
												{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.checkedAt")}
											</th>
											<th>{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.status")}</th>
											<th>{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.value")}</th>
											<th>
												{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.responseTime")}
											</th>
										</tr>
									</thead>
									<tbody>
										{results.map((result) => (
											<tr key={result.id}>
												<td>{new Date(result.checked_at).toLocaleString()}</td>
												<td>
													<Badge tone={STATUS_BADGE_TONE[result.status] ?? "neutral"}>
														{result.status}
													</Badge>
												</td>
												<td>
													<code>{result.resolved_value ?? result.error_message ?? "—"}</code>
												</td>
												<td>
													{result.response_time_ms === null ? "—" : `${result.response_time_ms}ms`}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
