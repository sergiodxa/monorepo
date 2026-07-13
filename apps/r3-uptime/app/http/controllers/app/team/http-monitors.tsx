/**
 * HTTP monitors list controller. Lists the team's monitors with their 24h health
 * badge (derived from Analytics Engine; see `app/services/analytics.ts`). Requires
 * `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { MonitorHealth } from "~/app/services/analytics";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import HttpMonitorsView from "~/resources/views/monitors/index";
import routes from "~/routes/web";

/** GET /app/:team/http — the team's HTTP monitors list. */
export default createAction(routes.app.team.httpMonitors, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let summaries = await getTeamHttpSummaries(ctx.team.id);
		let healthByMonitorId = new Map<string, MonitorHealth>(
			isFailure(summaries)
				? []
				: summaries.data.map((summary) => [summary.monitorId, summary.health]),
		);

		let rows = monitors.map((monitor) => ({
			monitor,
			health: healthByMonitorId.get(monitor.id) ?? ("pending" as MonitorHealth),
		}));

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · HTTP monitors`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb="HTTP monitors"
					actions={
						<a
							href={routes.app.team.monitorNew.href({ team: ctx.team.slug })}
							mix={[
								css({
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									padding: "8px 16px",
									borderRadius: 6,
									border: "1px solid transparent",
									background: "oklch(0.24 0.005 145)",
									color: "#ffffff",
									fontFamily: "inherit",
									fontSize: "0.875rem",
									fontWeight: 500,
									cursor: "pointer",
									textDecoration: "none",
									"&:hover": { background: "oklch(0.32 0.006 145)" },
								}),
							]}
						>
							New monitor
						</a>
					}
				>
					<HttpMonitorsView team={ctx.team} rows={rows} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
