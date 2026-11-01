/**
 * Dashboard "Slowest Endpoint" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/slowest-endpoint — loads the team's HTTP monitors (to
 * name the slowest one) and its Analytics Engine summaries, and renders one `StatCard`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Trans } from "@sdxc/i18n/ui";
import { isFailure } from "@sdxc/result";
import { StatCard } from "@sdxc/ui/app";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import routes from "~/routes/web";

/**
 * GET /app/:team/dashboard/cards/slowest-endpoint — the slowest-endpoint stat card,
 * fragment-only. An unreachable analytics store keeps the card's shape with the reason in
 * its footer.
 */
export default createAction(routes.app.team.dashboard.cards.slowestEndpoint, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let [monitors, summaries] = await Promise.all([
			ctx.models.monitors.inTeam(ctx.team.id).orderBy("created_at", "desc").all(),
			getTeamHttpSummaries(ctx.team.id),
		]);

		if (isFailure(summaries)) {
			return ctx.render(
				<StatCard>
					<StatCard.Label>
						{ctx.intl.t("page.dashboard.stats.slowestEndpoint.label.noData")}
					</StatCard.Label>
					<StatCard.Value>—</StatCard.Value>
					<StatCard.Footer role="status">
						{ctx.intl.t("page.dashboard.error.analytics.message")}
					</StatCard.Footer>
				</StatCard>,
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
			<StatCard>
				<StatCard.Label>
					{slowestMonitorName ? (
						<Trans
							intl={ctx.intl}
							i18nKey="page.dashboard.stats.slowestEndpoint.label.default"
							values={{ name: slowestMonitorName }}
							components={{ em: <em /> }}
						/>
					) : (
						ctx.intl.t("page.dashboard.stats.slowestEndpoint.label.noData")
					)}
				</StatCard.Label>
				<StatCard.Value>
					{slowestResponseMs === null
						? ctx.intl.t("page.dashboard.stats.slowestEndpoint.value.noData")
						: `${slowestResponseMs}ms`}
				</StatCard.Value>
				<StatCard.Footer>
					{ctx.intl.t("page.dashboard.stats.slowestEndpoint.description")}
				</StatCard.Footer>
			</StatCard>,
		);
	},
});
