/**
 * Dashboard "Uptime percentage" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/uptime — loads just the team's Analytics Engine
 * summaries and renders one `StatCard` as a bare fragment for its dashboard frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { StatCard } from "@sdxc/ui/app";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import routes from "~/routes/web";

/**
 * GET /app/:team/dashboard/cards/uptime — the uptime-percentage stat card, fragment-only.
 * When analytics is unreachable the card keeps its label and shape, with `—` for the value
 * and the reason in its footer, so the row never collapses around a missing card.
 */
export default createAction(routes.app.team.dashboard.cards.uptime, {
	middleware: [requireUser, requireTeam],
	handler: async () => {
		let ctx = getContext();

		let summaries = await getTeamHttpSummaries(ctx.team.id);

		if (isFailure(summaries)) {
			return ctx.render(
				<StatCard>
					<StatCard.Label>{ctx.intl.t("page.dashboard.stats.uptime.label")}</StatCard.Label>
					<StatCard.Value>—</StatCard.Value>
					<StatCard.Footer role="status">
						{ctx.intl.t("page.dashboard.error.analytics.message")}
					</StatCard.Footer>
				</StatCard>,
			);
		}

		let summaryList = summaries.data;
		let totalChecks = summaryList.reduce((sum, summary) => sum + summary.totalChecks, 0);
		let successfulChecks = summaryList.reduce((sum, summary) => sum + summary.successfulChecks, 0);
		let uptimePercent = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 100) : null;

		return ctx.render(
			<StatCard>
				<StatCard.Label>{ctx.intl.t("page.dashboard.stats.uptime.label")}</StatCard.Label>
				<StatCard.Value>{uptimePercent === null ? "—" : `${uptimePercent}%`}</StatCard.Value>
				<StatCard.Footer>{ctx.intl.t("page.dashboard.stats.uptime.description")}</StatCard.Footer>
			</StatCard>,
		);
	},
});
