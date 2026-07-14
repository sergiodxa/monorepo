/**
 * Dashboard "Slowest Endpoint" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/slowest-endpoint — loads the team's HTTP monitors (to
 * name the slowest one) and its Analytics Engine summaries, and renders `StatCard`
 * directly, with no document shell, so the dashboard's slowest-endpoint `Frame` can
 * swap it in over its skeleton fallback. Requires `requireUser` + `requireTeam`.
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
import { Empty, EmptyDescription } from "~/resources/components/empty";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/** GET /app/:team/dashboard/cards/slowest-endpoint — the slowest-endpoint stat card, fragment-only. */
export default createAction(routes.app.team.dashboard.cards.slowestEndpoint, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let [monitors, summaries] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			getTeamHttpSummaries(ctx.team.id),
		]);

		if (isFailure(summaries)) {
			return ctx.render(
				<Empty>
					<EmptyDescription>
						Analytics data temporarily unavailable. Please retry later.
					</EmptyDescription>
				</Empty>,
			);
		}

		let summaryList = summaries.data;
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
			<StatCard
				label={
					slowestMonitorName ? (
						<>
							Slowest Endpoint "<em>{slowestMonitorName}</em>"
						</>
					) : (
						"Slowest Endpoint"
					)
				}
				value={
					<>
						{slowestResponseMs === null ? "N/A" : `${slowestResponseMs}ms`}
						<Subtitle>In the last 24 hours</Subtitle>
					</>
				}
			/>,
		);
	}),
});
