/**
 * TCP monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * The controller reads the monitor row and nothing else, so the shell reaches the
 * browser on one query. The cards it does render — endpoint, status, interval,
 * timeout — are all fields of that row, so they cost nothing extra. The two things
 * that cost a query each, the 90-day uptime bar and the result history (with the
 * uptime/response-time/total-checks cards derived from it), load into their own named
 * `Frame`s over a skeleton fallback, so neither delays the page nor the other. The bar
 * sits above the table for the same reason it does everywhere: the summary is read
 * first, the rows only when it prompts a question.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { flex, flexWrap, gap, items } from "@pkg/u/layout";
import { m, mbe, mbs } from "@pkg/u/size";
import { Badge, Button, LinkButton } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Frame } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import StatCardSkeleton from "~/resources/components/stat-card-skeleton";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	timeout: "degraded",
	down: "down",
};

/** GET /app/:team/tcp/:monitorId — a TCP monitor's detail page. */
export default createAction(routes.app.team.tcpMonitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.tcpMonitorDetail.header.breadcrumb.tcpMonitors"),
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[flex(), items("center"), gap("12px")]}>
							<form
								method="post"
								action={routes.actions.monitor.tcp.check.href({ team: ctx.team.slug })}
								mix={[m("0")]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<Button type="submit">
									{ctx.i18next.t("page.tcpMonitorDetail.header.action.checkNow")}
								</Button>
							</form>
							<LinkButton
								href={routes.app.team.tcpMonitors.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.tcpMonitorDetail.header.action.edit")}
							</LinkButton>
						</div>
					}
				>
					<div>
						<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
							<StatCard
								label={ctx.i18next.t("page.tcpMonitorDetail.info.endpoint")}
								value={
									<code>
										{monitor.host}:{monitor.port}
									</code>
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.tcpMonitorDetail.info.status")}
								value={
									<Badge
										{...badgeVariant(STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}
									>
										{ctx.i18next.t(
											`page.tcpMonitors.table.status.${monitor.last_status ?? "pending"}`,
										)}
									</Badge>
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.tcpMonitorDetail.info.interval")}
								value={`${monitor.interval_seconds}s`}
							/>
							<StatCard
								label={ctx.i18next.t("page.tcpMonitorDetail.info.timeout")}
								value={`${monitor.timeout_ms}ms`}
							/>
						</div>

						{/*
						 * `StatCardSkeleton` renders bare cards with no row of its own, so several
						 * frames can share one row a caller lays out. Neither frame here shares a
						 * row with anything, so each supplies the row its own placeholders sit in —
						 * otherwise the cards stack flush while the page loads, which is not the
						 * shape either fragment resolves to. The gap matches the stat row above.
						 */}
						<Frame
							name="tcp-monitor-card-uptime-history"
							src={routes.app.team.tcpMonitors.cards.uptimeHistory.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							fallback={
								<div mix={[flex(), flexWrap(), gap("16px")]}>
									<StatCardSkeleton count={1} />
								</div>
							}
						/>

						{/*
						 * A `Frame` is a region rather than an element, so the space between the two
						 * belongs to a wrapper here — and it has to survive the swap, since the
						 * resolved sections need it just as much as the skeletons do.
						 */}
						<div mix={[mbs("24px")]}>
							<Frame
								name="tcp-monitor-card-results"
								src={routes.app.team.tcpMonitors.cards.results.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={
									<div mix={[flex(), flexWrap(), gap("16px")]}>
										<StatCardSkeleton count={3} />
									</div>
								}
							/>
						</div>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
