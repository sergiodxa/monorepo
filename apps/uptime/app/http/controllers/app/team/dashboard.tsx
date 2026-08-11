/**
 * Team dashboard controller. Resolves the selected monitor-type tab (query param,
 * falling back to the persisted cookie, then "http") and persists it back to the
 * cookie so a later visit without `?tab=` remembers it, then renders the dashboard
 * shell. All of the dashboard's actual data — the stat cards' usage/overview/count
 * figures and the tab table — loads via named `Frame`s pointed at their own
 * fragment routes (`dashboard-card-usage.tsx`, `-uptime.tsx`, `-slowest-endpoint.tsx`,
 * `-count.tsx`, `dashboard-panel.tsx`), so this controller no longer blocks on any of
 * it (notably Polar's API, the slowest of those fetches) before it can render the
 * page shell. Requires `requireUser` + `requireTeam`.
 *
 * The quick check is the header's action, in place of the "create monitor" button this
 * page used to end its header with. It is the one thing here a visitor submits, and it
 * belongs where a page's verbs already are; putting it there also gives the numbers below
 * the full width, which the fixed column it used to sit beside was taking off them. It
 * stays a `Frame` for the reason it always was — running a check has to swap that bar
 * alone, since a full navigation would refetch every frame around it to report one URL —
 * and its fallback is a pair of control-height bars rather than a card, since that is the
 * shape it streams into now.
 *
 * With the quick check gone from the content, the stat rows are two plain wrapping rows
 * rather than a grid: three overview figures, then one card per monitor type, each of
 * which carries the link to that type's own form. Those four links are what replaced the
 * single button, and they land on the specific form instead of a chooser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, flexWrap, gap, hidden, items } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { mbe } from "@pkg/u/size";
import { Empty, Skeleton } from "@pkg/ui";
import { pulse } from "@pkg/ui/animations";
import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";
import { Frame } from "remix/ui";

import type { DashboardTab } from "~/app/http/controllers/app/team/dashboard-panel";

import { COUNT_CARD_BREAKDOWN_LINES } from "~/app/http/controllers/app/team/dashboard-card-count";
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
						 * The fallback is the bar's own two controls, at the height they render at,
						 * and only where the bar is a row in the header: below 768px it is a popover
						 * behind an icon button, and a placeholder for a closed sheet would be a
						 * placeholder for nothing.
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
								fallback={<StatCardSkeleton count={1} subtitleLines={COUNT_CARD_BREAKDOWN_LINES} />}
							/>
							<Frame
								name="dashboard-card-count-dns"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "dns",
								})}
								fallback={<StatCardSkeleton count={1} subtitleLines={COUNT_CARD_BREAKDOWN_LINES} />}
							/>
							<Frame
								name="dashboard-card-count-tcp"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "tcp",
								})}
								fallback={<StatCardSkeleton count={1} subtitleLines={COUNT_CARD_BREAKDOWN_LINES} />}
							/>
							<Frame
								name="dashboard-card-count-cron-jobs"
								src={routes.app.team.dashboard.cards.count.href({
									team: ctx.team.slug,
									resource: "cron-jobs",
								})}
								fallback={<StatCardSkeleton count={1} subtitleLines={COUNT_CARD_BREAKDOWN_LINES} />}
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
