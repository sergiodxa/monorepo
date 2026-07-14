/**
 * TCP monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorShowView from "~/resources/views/tcp-monitors/show";
import routes from "~/routes/web";

/** GET /app/:team/tcp/:monitorId — a TCP monitor's detail page. */
export default createAction(routes.app.team.tcpMonitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await TcpMonitor.listResults(db, monitor.id);
		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "tcp");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: "Dashboard",
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: "TCP Monitors",
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
						{ label: monitor.name },
					]}
					actions={
						<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.monitor.tcp.check.href({ team: ctx.team.slug })}
								mix={[css({ margin: 0 })]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<Button type="submit" variant="outline">
									Check now
								</Button>
							</form>
							<LinkButton
								href={routes.app.team.tcpMonitors.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								variant="outline"
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								Edit
							</LinkButton>
						</div>
					}
				>
					<TcpMonitorShowView
						team={ctx.team}
						monitor={monitor}
						results={results}
						dailyStats={dailyStats}
					/>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
