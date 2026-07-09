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

import type { MonitorHealth } from "~/app/services/analytics";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import HttpMonitorsView from "~/resources/views/monitors/index";
import routes from "~/routes/web";

/** GET /app/:team/http — the team's HTTP monitors list. */
export default createAction(
	routes.app.team.httpMonitors,
	inject([Database] as const, async (db) => {
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

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · HTTP monitors`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<HttpMonitorsView team={ctx.team} rows={rows} />
					</AppShell>
				),
			}),
		);
	}),
);
