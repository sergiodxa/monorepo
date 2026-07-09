/**
 * New TCP monitor page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewTcpMonitorView from "~/resources/views/tcp-monitors/new";
import routes from "~/routes/web";

/** GET /app/:team/tcp/new — the new TCP monitor form. */
export default createAction(routes.app.team.tcpMonitorNew, () => {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	return ctx.render(
		<DocumentLayout title={`${ctx.team.name} · New TCP monitor`}>
			<AppShell team={ctx.team} viewer={viewer}>
				<NewTcpMonitorView team={ctx.team} />
			</AppShell>
		</DocumentLayout>,
	);
});
