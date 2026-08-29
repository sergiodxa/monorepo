/**
 * Dashboard "Slowest Endpoint" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/slowest-endpoint — loads the team's HTTP monitors (to
 * name the slowest one) and its Analytics Engine summaries, and renders `StatCard`
 * directly as a bare fragment, so the dashboard's slowest-endpoint `Frame` can
 * swap it in over its skeleton fallback. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Trans } from "@pkg/i18n/ui";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { Empty } from "@pkg/ui";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
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
					<Empty.Description>
						{ctx.i18next.t("page.dashboard.error.analytics.message")}
					</Empty.Description>
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
						<Trans
							i18n={ctx.i18next}
							i18nKey="page.dashboard.stats.slowestEndpoint.label.default"
							values={{ name: slowestMonitorName }}
							components={{ em: <em /> }}
						/>
					) : (
						ctx.i18next.t("page.dashboard.stats.slowestEndpoint.label.noData")
					)
				}
				value={
					<>
						{slowestResponseMs === null
							? ctx.i18next.t("page.dashboard.stats.slowestEndpoint.value.noData")
							: `${slowestResponseMs}ms`}
						<Subtitle>{ctx.i18next.t("page.dashboard.stats.slowestEndpoint.description")}</Subtitle>
					</>
				}
			/>,
		);
	}),
});
