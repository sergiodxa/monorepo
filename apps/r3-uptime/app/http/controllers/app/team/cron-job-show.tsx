/**
 * Cron-job monitor detail page controller. Requires `requireUser` + `requireTeam`;
 * 404s when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import StatCard from "~/resources/components/stat-card";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	healthy: "up",
	late: "degraded",
	missed: "down",
	new: "neutral",
};

/** GET /app/:team/cron-jobs/:monitorId — a cron-job monitor's detail page. */
export default createAction(routes.app.team.cronJobs.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await CronJobMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let pings = await CronJobMonitor.listPings(db, monitor.id);
		let pingUrl = new URL(
			routes.api.cronJobPing.href({ cronJobId: monitor.id }),
			ctx.request.url,
		).toString();
		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "cron");

		let totalPings = pings.length;
		let onTimeCount = pings.filter((ping) => ping.was_on_time).length;
		let onTimeRate = totalPings > 0 ? Math.round((onTimeCount / totalPings) * 100) : null;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.cronJobDetail.header.breadcrumb.cronJobs"),
							href: routes.app.team.cronJobs.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton
							href={routes.app.team.cronJobs.edit.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
						>
							<PencilIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.cronJobDetail.header.action.edit")}
						</LinkButton>
					}
				>
					<div>
						{monitor.description && (
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								{monitor.description}
							</p>
						)}

						<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
							<div
								mix={[
									css({
										flex: "1 1 160px",
										padding: 16,
										borderRadius: 8,
										border: `1px solid ${neutral[200]}`,
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
									}),
								]}
							>
								<div
									mix={[
										css({
											fontSize: "0.8125rem",
											color: neutral[500],
											"@media (prefers-color-scheme: dark)": { color: neutral[400] },
										}),
									]}
								>
									{ctx.i18next.t("page.cronJobDetail.info.schedule")}
								</div>
								<div mix={[css({ fontSize: "1.5rem", fontWeight: 700, lineHeight: "2rem" })]}>
									{CronJobMonitor.describeCronExpression(monitor.cron_expression)}
								</div>
								<code>{monitor.cron_expression}</code>
							</div>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.info.status")}
								value={
									<Badge tone={STATUS_BADGE_TONE[monitor.status] ?? "neutral"}>
										{monitor.status}
									</Badge>
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.info.timezone")}
								value={monitor.timezone}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.info.gracePeriod")}
								value={`${monitor.grace_period_seconds}s`}
							/>
						</div>

						<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.lastPing.label")}
								value={
									monitor.last_ping_at === null
										? "Never"
										: new Date(monitor.last_ping_at).toLocaleString()
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.nextExpected.label")}
								value={
									monitor.next_expected_at === null
										? "—"
										: new Date(monitor.next_expected_at).toLocaleString()
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.onTimeRate.label")}
								value={onTimeRate === null ? "—" : `${onTimeRate}%`}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.totalPings.label")}
								value={totalPings}
							/>
						</div>

						<h2>Ping this monitor</h2>
						<p
							mix={[
								css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							Have your job send a POST request here after it finishes. No authentication required —
							treat this URL as a secret.
						</p>
						<pre
							mix={[
								css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							<code>POST {pingUrl}</code>
						</pre>
						<pre
							mix={[
								css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							<code>curl -X POST {pingUrl}</code>
						</pre>
						<pre
							mix={[
								css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							<code>0 * * * * your-job.sh &amp;&amp; curl -fsS -X POST {pingUrl}</code>
						</pre>

						<h2>Uptime history</h2>
						<Heatmap days={dailyStats} />

						<h2>{ctx.i18next.t("page.cronJobDetail.pings.title")}</h2>
						{pings.length === 0 ? (
							<Empty>
								<Empty.Description>
									{ctx.i18next.t("page.cronJobDetail.pings.empty")}
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
											<th>{ctx.i18next.t("page.cronJobDetail.pings.columns.time")}</th>
											<th>{ctx.i18next.t("page.cronJobDetail.pings.columns.status")}</th>
											<th>{ctx.i18next.t("page.cronJobDetail.pings.columns.sourceIp")}</th>
										</tr>
									</thead>
									<tbody>
										{pings.map((ping) => (
											<tr key={ping.id}>
												<td>{new Date(ping.created_at).toLocaleString()}</td>
												<td>
													<Badge tone={ping.was_on_time ? "up" : "degraded"}>
														{ping.was_on_time
															? ctx.i18next.t("page.cronJobDetail.pings.status.onTime")
															: ctx.i18next.t("page.cronJobDetail.pings.status.late")}
													</Badge>
												</td>
												<td>{ping.source_ip ?? "—"}</td>
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
