/**
 * Team dashboard controller. Resolves the monitor-type tab from `?tab=`, falling back to
 * the persisted cookie then "http", and persists the choice back to the cookie. Every card
 * and the panel stream in through their own frames behind skeletons of the same shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { iife } from "@sdxc/iife";
import { flex, flexCol, gap, hidden, items } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { pulse } from "@sdxc/ui/animations";
import { Skeleton, StatCard, Table } from "@sdxc/ui/app";
import { Frame } from "remix/component";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { DashboardTab } from "~/app/http/controllers/app/team/dashboard-panel";

import { panelSrc, refreshInterval } from "~/app/http/controllers/app/team/dashboard-panel";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { dashboardTab as dashboardTabCookie } from "~/app/initializers/cookies";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DASHBOARD_TABS: readonly DashboardTab[] = ["http", "dns", "tcp", "cron-jobs"];

/** The monitor types counted in the second row of cards, in the order they read. */
const COUNT_RESOURCES = ["http", "dns", "tcp", "flow", "cron-jobs"] as const;

function isDashboardTab(value: string | null): value is DashboardTab {
	return value !== null && (DASHBOARD_TABS as readonly string[]).includes(value);
}

interface Toast {
	intent: "success" | "error";
	message: string;
}

/**
 * GET /app/:team/dashboard — the team's overview. The `refresh` interval in the URL reaches
 * the panel's frame, so an interval chosen there survives a reload and a tab switch.
 */
export default createAction(routes.app.team.dashboard.index, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let cookieTab = await dashboardTabCookie.parse(ctx.request.headers.get("Cookie"));
		let queryTab = ctx.url.searchParams.get("tab");
		let tab = iife((): DashboardTab => {
			if (isDashboardTab(queryTab)) return queryTab;
			if (isDashboardTab(cookieTab)) return cookieTab;
			return "http";
		});
		let refresh = refreshInterval(ctx.url.searchParams.get("refresh"));

		let toast = ctx.get(Session)?.get("toast") as Toast | undefined;

		let headers = new Headers();
		headers.set("Set-Cookie", await dashboardTabCookie.serialize(tab));

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · Dashboard`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.dashboard.header.title")}
					actions={
						/**
						 * The fallback mirrors the bar's own two controls at the height they render at,
						 * shown only where the bar is a header row (768px and up); below that width the
						 * quick check lives in a popover behind an icon button instead.
						 */
						<Frame
							name="dashboard-quick-ping"
							src={routes.app.team.dashboard.quickPing.href({ team: ctx.team.slug })}
							fallback={
								<div
									mix={[hidden(), gap("8px"), items("center"), media("(min-width: 768px)", flex())]}
								>
									<Skeleton style={{ inlineSize: "240px", blockSize: "2.5rem" }} mix={[pulse()]} />
									<Skeleton style={{ inlineSize: "104px", blockSize: "2.5rem" }} mix={[pulse()]} />
								</div>
							}
						/>
					}
					toast={toast}
				>
					<div mix={[flex(), flexCol(), gap("24px")]}>
						<StatCard.Group columns={3} aria-label={ctx.intl.t("page.dashboard.groups.summary")}>
							<Frame
								name="dashboard-card-usage"
								src={routes.app.team.dashboard.cards.usage.href({ team: ctx.team.slug })}
								fallback={<StatCard.Skeleton delta={false} />}
							/>
							<Frame
								name="dashboard-card-uptime"
								src={routes.app.team.dashboard.cards.uptime.href({ team: ctx.team.slug })}
								fallback={<StatCard.Skeleton delta={false} />}
							/>
							<Frame
								name="dashboard-card-slowest-endpoint"
								src={routes.app.team.dashboard.cards.slowestEndpoint.href({
									team: ctx.team.slug,
								})}
								fallback={<StatCard.Skeleton delta={false} />}
							/>
						</StatCard.Group>

						<StatCard.Group
							columns={COUNT_RESOURCES.length}
							aria-label={ctx.intl.t("page.dashboard.groups.counts")}
						>
							{COUNT_RESOURCES.map((resource) => (
								<Frame
									key={resource}
									name={`dashboard-card-count-${resource}`}
									src={routes.app.team.dashboard.cards.count.href({
										team: ctx.team.slug,
										resource,
									})}
									fallback={<StatCard.Skeleton delta={false} />}
								/>
							))}
						</StatCard.Group>

						<Frame
							name="dashboard-panel"
							src={panelSrc(ctx.team.slug, tab, refresh)}
							fallback={
								<Table.Container>
									<Table>
										<Skeleton.Table
											rows={5}
											columns={5}
											label={ctx.intl.t("page.dashboard.loading")}
										/>
									</Table>
								</Table.Container>
							}
						/>
					</div>
				</AppShell>
			</DocumentLayout>,
			{ headers },
		);
	},
});
