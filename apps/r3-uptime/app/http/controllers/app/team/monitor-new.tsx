/**
 * New HTTP monitor page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewMonitorView from "~/resources/views/monitors/new";
import routes from "~/routes/web";

/** GET /app/:team/monitors/new — the new monitor form. */
export default createAction(routes.app.team.monitorNew, () => {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	return ctx.render(
		<DocumentLayout title={`${ctx.team.name} · New monitor`}>
			<AppShell
				team={ctx.team}
				teams={ctx.teams}
				viewer={viewer}
				isAdmin={ctx.membership.role === "admin"}
			>
				<NewMonitorView team={ctx.team} />
			</AppShell>
		</DocumentLayout>,
	);
});
