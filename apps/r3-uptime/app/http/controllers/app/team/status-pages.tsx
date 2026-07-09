/**
 * Status pages list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import StatusPage from "~/app/data/status-page";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import StatusPagesView from "~/resources/views/status-pages/index";
import routes from "~/routes/web";

/** GET /app/:team/status-pages — the team's status pages list. */
export default createAction(
	routes.app.team.statusPages,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let pages = await StatusPage.listByTeam(db, ctx.team.id);
		let attachedCounts = await Promise.all(
			pages.map(async (page) => {
				let ids = await StatusPage.getAttachedIds(db, page.id);
				return (
					ids.monitorIds.length +
					ids.dnsMonitorIds.length +
					ids.tcpMonitorIds.length +
					ids.cronJobIds.length
				);
			}),
		);
		let countsByPageId = new Map(pages.map((page, index) => [page.id, attachedCounts[index] ?? 0]));

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · Status pages`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<StatusPagesView team={ctx.team} pages={pages} countsByPageId={countsByPageId} />
					</AppShell>
				),
			}),
		);
	}),
);
