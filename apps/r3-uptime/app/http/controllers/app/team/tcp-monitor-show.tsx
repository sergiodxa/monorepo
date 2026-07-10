/**
 * TCP monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
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
import { css } from "remix/ui";

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorShowView from "~/resources/views/tcp-monitors/show";
import routes from "~/routes/web";

/** Secondary (outline) button/link, matching the OLD APP's "Cancel" button. Reused below. */
const buttonSecondary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "2px solid oklch(0.83 0.01 145)",
	background: "#ffffff",
	color: "oklch(0.62 0.01 145)",
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: "oklch(0.98 0.005 145)" },
	"@media (prefers-color-scheme: dark)": {
		background: "oklch(0.24 0.005 145)",
		color: "oklch(0.73 0.01 145)",
		borderColor: "oklch(0.42 0.008 145)",
		"&:hover": { background: "oklch(0.32 0.006 145)" },
	},
});

/** GET /app/:team/tcp/:monitorId — a TCP monitor's detail page. */
export default createAction(
	routes.app.team.tcpMonitorShow,
	inject([Database] as const, async (db) => {
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
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb={monitor.name}
					actions={
						<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.checkTcpMonitor.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<button type="submit" mix={[buttonSecondary]}>
									Check now
								</button>
							</form>
							<a
								href={routes.app.team.tcpMonitorEdit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								mix={[buttonSecondary]}
							>
								Edit
							</a>
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
);
