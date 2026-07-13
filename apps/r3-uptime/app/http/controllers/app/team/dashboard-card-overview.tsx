/**
 * Dashboard "Uptime percentage" + "Slowest Endpoint" stat-card fragment controller.
 * GET /app/:team/dashboard/cards/overview — loads the team's HTTP monitors (to name
 * the slowest one) and its Analytics Engine summaries, with no document shell, so the
 * dashboard's overview `Frame` can swap it in over its skeleton fallback. Requires
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

import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import DashboardCardOverviewView from "~/resources/views/dashboard-card-overview";
import routes from "~/routes/web";

/** GET /app/:team/dashboard/cards/overview — the uptime/slowest-endpoint stat cards, fragment-only. */
export default createAction(routes.app.team.dashboardCardOverview, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let [monitors, summaries] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			getTeamHttpSummaries(ctx.team.id),
		]);

		let analyticsUnavailable = isFailure(summaries);
		let summaryList = isFailure(summaries) ? [] : summaries.data;

		let totalChecks = summaryList.reduce((sum, summary) => sum + summary.totalChecks, 0);
		let successfulChecks = summaryList.reduce((sum, summary) => sum + summary.successfulChecks, 0);
		let uptimePercent = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 100) : null;

		let slowestSummary = summaryList.reduce<(typeof summaryList)[number] | null>(
			(slowest, summary) => {
				if (!slowest || summary.maxResponseTimeMs > slowest.maxResponseTimeMs) return summary;
				return slowest;
			},
			null,
		);
		let slowestResponseMs = slowestSummary?.maxResponseTimeMs ?? null;
		let slowestMonitorName =
			(slowestSummary &&
				monitors.find((monitor) => monitor.id === slowestSummary.monitorId)?.name) ??
			null;

		return ctx.render(
			<DashboardCardOverviewView
				uptimePercent={uptimePercent}
				slowestResponseMs={slowestResponseMs}
				slowestMonitorName={slowestMonitorName}
				analyticsUnavailable={analyticsUnavailable}
			/>,
		);
	}),
});
