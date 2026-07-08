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
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import DnsMonitorsView from "~/resources/views/dns-monitors/index";
import routes from "~/routes/web";

/** GET /app/:team/dns — the team's DNS monitors list. */
export default createAction(
	routes.app.team.dnsMonitors,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await DnsMonitor.listByTeam(db, ctx.team.id);

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · DNS monitors`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<DnsMonitorsView team={ctx.team} monitors={monitors} />
					</AppShell>
				),
			}),
		);
	}),
);
