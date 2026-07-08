/**
 * Team dashboard controller. Renders the app shell around the (currently empty)
 * dashboard view, reading any flashed toast message set by a prior action. Requires
 * `requireUser` + `requireTeam`, so `ctx.team`/`ctx.membership` are always present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import DashboardView from "~/resources/views/dashboard";
import routes from "~/routes/web";

interface Toast {
	intent: "success" | "error";
	message: string;
}

/** GET /app/:team/dashboard — the team's dashboard shell. */
export default createAction(routes.app.team.dashboard, (ctx) => {
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let toast = ctx.get(Session)?.get("toast") as Toast | undefined;

	let renderDocument = DocumentLayout();
	return ctx.render(
		renderDocument({
			title: `${ctx.team.name} · Dashboard`,
			children: (
				<AppShell team={ctx.team} viewer={viewer} toast={toast}>
					<DashboardView teamName={ctx.team.name} />
				</AppShell>
			),
		}),
	);
});
