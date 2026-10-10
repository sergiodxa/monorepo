/**
 * Dashboard "Monthly Pings Usage" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/usage — loads just the team's ping usage, with no
 * document shell, so the dashboard's usage `Frame` can swap it in over its skeleton
 * fallback without blocking the rest of the page on it. Requires `requireUser` +
 * `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import type { UptimeModels } from "~/app/models";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/**
 * Counts pings consumed this month and, independently, projects consumption from
 * current monitor settings, run in parallel via `Promise.allSettled` so one query's
 * failure still lets the other render. Each resolves to `null` on failure, so "usage unavailable" is never shown as "0 used".
 */
async function getPingUsage(
	models: UptimeModels,
	team: { id: string },
): Promise<{ consumed: number | null; usage: number | null }> {
	let now = new Date();
	let [consumedResult, usageResult] = await Promise.allSettled([
		models.monitors.countConsumedPingsByTeam(team.id, now),
		models.monitors.estimateConsumedPingsByTeam(team.id, now),
	]);

	return {
		consumed: consumedResult.status === "fulfilled" ? consumedResult.value : null,
		usage: usageResult.status === "fulfilled" ? usageResult.value : null,
	};
}

/** GET /app/:team/dashboard/cards/usage — the ping-usage stat card, fragment-only. */
export default createAction(routes.app.team.dashboard.cards.usage, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { consumed, usage } = await getPingUsage(ctx.models, ctx.team);

		if (consumed === null && usage === null) {
			return ctx.render(
				<StatCard
					label={ctx.intl.t("page.dashboard.error.card.label")}
					value={
						<>
							{ctx.intl.t("page.dashboard.error.card.value")}
							<Subtitle>{ctx.intl.t("page.dashboard.error.card.description")}</Subtitle>
						</>
					}
				/>,
			);
		}

		return ctx.render(
			<StatCard
				label={ctx.intl.t("page.dashboard.stats.monitors.label")}
				value={
					<>
						{consumed === null ? "—" : consumed.toLocaleString()}
						<Subtitle>
							{usage === null
								? ctx.intl.t("page.dashboard.stats.monitors.unavailable")
								: ctx.intl.t("page.dashboard.stats.monitors.description", {
										estimated: usage.toLocaleString(),
									})}
						</Subtitle>
					</>
				}
			/>,
		);
	},
});
