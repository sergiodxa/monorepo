/**
 * New DNS monitor page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewDnsMonitorView from "~/resources/views/dns-monitors/new";
import routes from "~/routes/web";

/** GET /app/:team/dns/new — the new DNS monitor form. */
export default createAction(routes.app.team.dnsMonitorNew, () => {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let renderDocument = DocumentLayout();
	return ctx.render(
		renderDocument({
			title: `${ctx.team.name} · New DNS monitor`,
			children: (
				<AppShell team={ctx.team} viewer={viewer}>
					<NewDnsMonitorView team={ctx.team} />
				</AppShell>
			),
		}),
	);
});
