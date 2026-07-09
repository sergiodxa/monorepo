/**
 * New status page page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewStatusPageView from "~/resources/views/status-pages/new";
import routes from "~/routes/web";

/** GET /app/:team/status-pages/new — the new status-page form. */
export default createAction(
	routes.app.team.statusPageNew,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [monitors, dnsMonitors, tcpMonitors, cronJobs] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
		]);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New status page`}>
				<AppShell team={ctx.team} viewer={viewer}>
					<NewStatusPageView
						team={ctx.team}
						monitors={monitors}
						dnsMonitors={dnsMonitors}
						tcpMonitors={tcpMonitors}
						cronJobs={cronJobs}
					/>
				</AppShell>
			</DocumentLayout>,
		);
	}),
);
