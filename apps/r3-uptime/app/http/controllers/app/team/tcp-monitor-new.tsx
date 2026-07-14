/**
 * New TCP monitor page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewTcpMonitorView from "~/resources/views/tcp-monitors/new";
import routes from "~/routes/web";

/** GET /app/:team/tcp/new — the new TCP monitor form. */
export default createAction(routes.app.team.tcpMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New TCP monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="Create TCP Monitor"
					breadcrumbs={[
						{
							label: "Dashboard",
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: "TCP Monitors",
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
						{ label: "Create TCP Monitor" },
					]}
				>
					<NewTcpMonitorView team={ctx.team} />
				</AppShell>
			</DocumentLayout>,
		);
	},
});
