/**
 * HTTP monitors list controller. Lists the team's monitors, each paired with its
 * single most recent Analytics Engine result (see `getLatestHttpResult` in
 * `app/services/analytics.ts`), fetched one query per monitor in parallel via
 * `Promise.all` — the same "one query per monitor, run in parallel" pattern this app
 * already uses elsewhere for per-row Analytics Engine data. From that latest result, a
 * per-monitor status (up/degraded/down/unknown) is derived via `calculateMonitorStatus`.
 * Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PlusIcon } from "@pkg/lucide-remix";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { calculateMonitorStatus, getLatestHttpResult } from "~/app/services/analytics";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import HttpMonitorsView from "~/resources/views/monitors/index";
import routes from "~/routes/web";

/** GET /app/:team/http — the team's HTTP monitors list. */
export default createAction(routes.app.team.monitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		let latestResults = await Promise.all(
			monitors.map((monitor) => getLatestHttpResult(ctx.team.id, monitor.id)),
		);

		let rows = monitors.map((monitor, index) => {
			let latestResult = latestResults[index]!;
			let latest = isFailure(latestResult) ? null : latestResult.data;

			return {
				monitor,
				status: calculateMonitorStatus(latest, monitor.expected_status, monitor.degraded_after_ms),
				responseTimeMs: latest?.responseTimeMs ?? null,
				lastCheckedAt: latest?.timestamp ?? null,
			};
		});

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · HTTP monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="HTTP Monitors"
					breadcrumbs={[
						{
							label: "Dashboard",
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							Create HTTP Monitor
						</LinkButton>
					}
				>
					<HttpMonitorsView team={ctx.team} rows={rows} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
