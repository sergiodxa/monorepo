/**
 * Edit status page page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the page doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import EditStatusPageView from "~/resources/views/status-pages/edit";
import routes from "~/routes/web";

/** GET /app/:team/status-pages/:statusPageId/edit — a status page's edit form. */
export default createAction(routes.app.team.statusPages.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { statusPageId } = s.parse(s.object({ statusPageId: s.string() }), ctx.params);
		let page = await StatusPage.findByIdForTeam(db, ctx.team.id, statusPageId);
		if (!page) return notFound("Not Found");

		let [monitors, dnsMonitors, tcpMonitors, cronJobs, attachedIds] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
			StatusPage.getAttachedIds(db, statusPageId),
		]);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${page.name}`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="Edit Status Page"
					breadcrumbs={[
						{
							label: "Status Pages",
							href: routes.app.team.statusPages.index.href({ team: ctx.team.slug }),
						},
						{ label: page.name },
						{ label: "Edit Status Page" },
					]}
				>
					<EditStatusPageView
						team={ctx.team}
						page={page}
						monitors={monitors}
						dnsMonitors={dnsMonitors}
						tcpMonitors={tcpMonitors}
						cronJobs={cronJobs}
						attachedIds={attachedIds}
					/>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
