/**
 * Flow monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s when the
 * monitor doesn't belong to the current team.
 *
 * The controller reads the monitor row and nothing else, so the shell reaches the browser on one
 * query. The cards it renders — status, interval, last checked — are all fields of that row, so
 * they cost nothing extra. The one thing that costs a query, the run history (with the pass-rate,
 * average-duration and total-runs cards derived from it, and the flow's own source marked at the
 * line the last failure names), loads into its own named `Frame` over a skeleton fallback. The
 * same division every other monitor detail page keeps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDateTime, formatRelative } from "@pkg/dates";
import { notFound } from "@pkg/http/response/html";
import { IntlProvider } from "@pkg/i18n/ui";
import { PencilIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { flex, flexWrap, gap, hidden, items } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { mbe } from "@pkg/u/size";
import { nowrap } from "@pkg/u/typography";
import { Badge, LinkButton } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Frame } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import FlowMonitor from "~/app/data/flow-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import RunFlowButton from "~/resources/components/run-flow-button";
import StatCard from "~/resources/components/stat-card";
import StatCardSkeleton from "~/resources/components/stat-card-skeleton";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** `error` is neutral, not `down`: it means this app could not find out (ADR-027 §8). */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	down: "down",
	error: "neutral",
};

/** GET /app/:team/flows/:monitorId — a flow monitor's detail page. */
export default createAction(routes.app.team.flowMonitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await FlowMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
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
							label: ctx.i18next.t("page.flowMonitorDetail.header.breadcrumb.flowMonitors"),
							href: routes.app.team.flowMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[flex(), items("center"), gap("12px"), nowrap()]}>
							{/*
							 * RunFlowButton is a `clientEntry` island whose render function runs both
							 * server-side (the no-JS baseline markup) and client-side (after hydration).
							 * Client-side, `intl(handle)` falls back to the module-scoped default
							 * `bootstrap/browser.ts` registers via `setIntl()` — never set server-side, since
							 * a module-scoped instance would leak across concurrent requests in a Workers
							 * isolate — so the SSR pass needs this request-scoped `IntlProvider` ancestor.
							 *
							 * An island and not the plain `<form>` the other detail pages post with, because a
							 * flow runs inline and may take most of thirty seconds: the hydrated path keeps the
							 * button pending and toasts the outcome instead of holding a navigation open for
							 * that long. The `<form>` inside it is still the no-JS baseline.
							 */}
							<IntlProvider i18n={ctx.i18next}>
								<RunFlowButton
									action={routes.actions.monitor.flow.check.href({ team: ctx.team.slug })}
									monitorId={monitor.id}
									name={monitor.name}
								/>
							</IntlProvider>
							{/*
							 * Hidden on a phone, where the header has room for one action and "Run now" is
							 * the one somebody came for. Editing is still a tap away through the list's row
							 * menu, so nothing becomes unreachable — the button is redundant, not essential.
							 */}
							<div mix={[hidden(), media("(min-width: 640px)", flex())]}>
								<LinkButton
									href={routes.app.team.flowMonitors.edit.href({
										team: ctx.team.slug,
										monitorId: monitor.id,
									})}
								>
									<PencilIcon size={16} strokeWidth={1.5} />
									{ctx.i18next.t("page.flowMonitorDetail.header.action.edit")}
								</LinkButton>
							</div>
						</div>
					}
				>
					<div>
						<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
							<StatCard
								label={ctx.i18next.t("page.flowMonitorDetail.info.status")}
								value={
									<Badge
										{...badgeVariant(STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}
									>
										{ctx.i18next.t(
											`page.flowMonitors.table.status.${monitor.last_status ?? "pending"}`,
										)}
									</Badge>
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.flowMonitorDetail.info.interval")}
								value={ctx.i18next.t(
									`page.createFlowMonitor.form.fields.interval.options.${monitor.interval_seconds}`,
								)}
							/>
							<StatCard
								label={ctx.i18next.t("page.flowMonitorDetail.info.lastChecked")}
								value={
									monitor.last_checked_at === null ? (
										"—"
									) : (
										<time
											datetime={new Date(monitor.last_checked_at).toISOString()}
											title={formatDateTime(new Date(monitor.last_checked_at), {
												locale: ctx.locale,
												timeZone: "UTC",
											})}
										>
											{formatRelative(new Date(monitor.last_checked_at), { locale: ctx.locale })}
										</time>
									)
								}
							/>
							{!monitor.is_enabled && (
								<StatCard
									label={ctx.i18next.t("page.flowMonitorDetail.info.enabled")}
									value={
										<Badge {...badgeVariant("neutral")}>
											{ctx.i18next.t("page.flowMonitors.table.status.disabled")}
										</Badge>
									}
								/>
							)}
						</div>

						{/*
						 * `StatCardSkeleton` renders bare cards with no row of its own, so several frames
						 * can share one row a caller lays out. This frame shares a row with nothing, so it
						 * supplies the row its own placeholders sit in — otherwise the cards stack flush
						 * while the page loads, which is not the shape the fragment resolves to. The gap
						 * matches the stat row above.
						 */}
						<Frame
							name="flow-monitor-card-results"
							src={routes.app.team.flowMonitors.cards.results.href({
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
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
