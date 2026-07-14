/**
 * New DNS monitor page controller. Requires `requireUser` + `requireTeam`.
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
import NewDnsMonitorView from "~/resources/views/dns-monitors/new";
import routes from "~/routes/web";

/** GET /app/:team/dns/new — the new DNS monitor form. */
export default createAction(routes.app.team.dnsMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New DNS monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="Create DNS Monitor"
					breadcrumbs={[
						{
							label: "DNS Monitors",
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
						{ label: "Create DNS Monitor" },
					]}
				>
					<NewDnsMonitorView team={ctx.team} />
				</AppShell>
			</DocumentLayout>,
		);
	},
});
