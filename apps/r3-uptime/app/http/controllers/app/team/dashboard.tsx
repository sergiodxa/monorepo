/**
 * Team dashboard controller. Resolves the selected monitor-type tab (query param,
 * falling back to the persisted cookie, then "http") and persists it back to the
 * cookie so a later visit without `?tab=` remembers it, then renders the dashboard
 * shell. All of the dashboard's actual data — the stat cards' usage/overview/count
 * figures and the tab table — loads via named `Frame`s the view points at their own
 * fragment routes (`dashboard-card-usage.tsx`, `-overview.tsx`, `-counts.tsx`,
 * `dashboard-panel.tsx`), so this controller no longer blocks on any of it (notably
 * Polar's API, the slowest of those fetches) before it can render the page shell.
 * Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";
import { css } from "remix/ui";

import type { DashboardTab } from "~/resources/views/dashboard";

import { dashboardTab as dashboardTabCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
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
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb="Dashboard"
					actions={
						<a
							href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}
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
					<DashboardView team={ctx.team} tab={tab} />
				</AppShell>
			</DocumentLayout>,
			{ headers },
		);
	},
});
