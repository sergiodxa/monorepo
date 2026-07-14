/**
 * DNS monitors list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import DnsMonitor from "~/app/data/dns-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import DnsMonitorsView from "~/resources/views/dns-monitors/index";
import routes from "~/routes/web";

/** GET /app/:team/dns — the team's DNS monitors list. */
export default createAction(routes.app.team.dnsMonitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await DnsMonitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · DNS monitors`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb="DNS monitors"
					actions={
						<LinkButton href={routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug })}>
							New DNS monitor
						</LinkButton>
					}
				>
					<DnsMonitorsView team={ctx.team} monitors={monitors} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
