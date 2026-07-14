/**
 * Dashboard "Uptime percentage" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/uptime — loads just the team's Analytics Engine
 * summaries and renders `StatCard` directly, with no document shell, so the
 * dashboard's uptime `Frame` can swap it in over its skeleton fallback. Requires
 * `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import Empty from "~/resources/components/empty";
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
						Analytics data temporarily unavailable. Please retry later.
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
				label="Uptime percentage"
				value={
					<>
						{uptimePercent === null ? "—" : `${uptimePercent}%`}
						<Subtitle>Overall system uptime</Subtitle>
					</>
				}
			/>,
		);
	},
});
