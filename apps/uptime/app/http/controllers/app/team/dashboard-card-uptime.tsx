/**
 * Dashboard "Uptime percentage" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/uptime — loads just the team's Analytics Engine
 * summaries and renders `StatCard` directly as a bare fragment, so the
 * dashboard's uptime `Frame` can swap it in over its skeleton fallback. Requires
 * `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { Empty } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/** GET /app/:team/dashboard/cards/uptime — the uptime-percentage stat card, fragment-only. */
export default createAction(routes.app.team.dashboard.cards.uptime, {
	middleware: [requireUser, requireTeam],
	handler: async () => {
		let ctx = getContext();

		let summaries = await getTeamHttpSummaries(ctx.team.id);

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
		let totalChecks = summaryList.reduce((sum, summary) => sum + summary.totalChecks, 0);
		let successfulChecks = summaryList.reduce((sum, summary) => sum + summary.successfulChecks, 0);
		let uptimePercent = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 100) : null;

		return ctx.render(
			<StatCard
				label={ctx.i18next.t("page.dashboard.stats.uptime.label")}
				value={
					<>
						{uptimePercent === null ? "—" : `${uptimePercent}%`}
						<Subtitle>{ctx.i18next.t("page.dashboard.stats.uptime.description")}</Subtitle>
					</>
				}
			/>,
		);
	},
});
