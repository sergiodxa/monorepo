/**
 * Team dashboard controller. Resolves the monitor-type tab from `?tab=`, falling back to
 * the persisted cookie then "http", and persists the choice back to the cookie. The stat
 * cards and tab table load via named `Frame`s pointed at their own fragment routes, so the
 * page shell renders immediately while their slowest fetch (Polar's usage API) streams in
 * behind each fallback. The quick check is the header's action and stays its own `Frame`,
 * isolating a check run to that bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, flexWrap, gap, hidden, items } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { mbe } from "@pkg/u/size";
import { Empty, Skeleton } from "@pkg/ui";
import { pulse } from "@pkg/ui/animations";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Session } from "remix/session";
import { Frame } from "remix/ui";

import type { DashboardTab } from "~/app/http/controllers/app/team/dashboard-panel";

import { dashboardTab as dashboardTabCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import StatCardSkeleton from "~/resources/components/stat-card-skeleton";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DASHBOARD_TABS: readonly DashboardTab[] = ["http", "dns", "tcp", "cron-jobs"];

function isDashboardTab(value: string | null): value is DashboardTab {
	return value !== null && (DASHBOARD_TABS as readonly string[]).includes(value);
}

interface Toast {
	intent: "success" | "error";
	message: string;
}

/** GET /app/:team/dashboard — the team's dashboard shell. */
export default createAction(routes.app.team.dashboard.index, {
	middleware: [requireUser, requireTeam],
	handler: async () => {
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

		let headers = new Headers();
		headers.set("Set-Cookie", await dashboardTabCookie.serialize(tab));

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Dashboard`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.dashboard.header.title")}
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
					<div>
						<div mix={[flex(), flexWrap(), gap("16px"), mbe("16px")]}>
							<Frame
								name="dashboard-card-usage"
								src={routes.app.team.dashboard.cards.usage.href({ team: ctx.team.slug })}
								fallback={<StatCardSkeleton count={1} />}
							/>
							<Frame
								name="dashboard-card-uptime"
								src={routes.app.team.dashboard.cards.uptime.href({ team: ctx.team.slug })}
								fallback={<StatCardSkeleton count={1} />}
							/>
							<Frame
								name="dashboard-card-slowest-endpoint"
								src={routes.app.team.dashboard.cards.slowestEndpoint.href({
									team: ctx.team.slug,
								})}
								fallback={<StatCardSkeleton count={1} />}
							/>
						</div>

						<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
							<Frame
								name="dashboard-card-count-http"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "http",
								})}
								fallback={<StatCardSkeleton count={1} badges />}
							/>
							<Frame
								name="dashboard-card-count-dns"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "dns",
								})}
								fallback={<StatCardSkeleton count={1} badges />}
							/>
							<Frame
								name="dashboard-card-count-tcp"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "tcp",
								})}
								fallback={<StatCardSkeleton count={1} badges />}
							/>
							<Frame
								name="dashboard-card-count-flow"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "flow",
								})}
								fallback={<StatCardSkeleton count={1} badges />}
							/>
							<Frame
								name="dashboard-card-count-cron-jobs"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "cron-jobs",
								})}
								fallback={<StatCardSkeleton count={1} badges />}
							/>
						</div>

						<Frame
							name="dashboard-panel"
							src={routes.app.team.dashboard.panel.href({ team: ctx.team.slug, type: tab })}
							fallback={
								<Empty>
									<Empty.Description>{ctx.i18next.t("page.dashboard.loading")}</Empty.Description>
								</Empty>
							}
						/>
					</div>
				</AppShell>
			</DocumentLayout>,
			{ headers },
		);
	},
});
