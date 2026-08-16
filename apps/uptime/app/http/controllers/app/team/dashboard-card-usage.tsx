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

import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/**
 * Counts the pings the team has consumed so far this month and, independently,
 * projects the consumption its current monitor settings imply — both from the local
 * check history, in parallel, via `Promise.allSettled` so a failure in either one
 * still lets the other render rather than discarding both. Each resolves to `null` —
 * rendered below as "unavailable" — when its own query failed, since "usage
 * unavailable" must never be shown to the user as "0 used".
 */
async function getPingUsage(
	db: Database,
	team: { id: string },
): Promise<{ consumed: number | null; usage: number | null }> {
	let now = new Date();
	let [consumedResult, usageResult] = await Promise.allSettled([
		Monitor.countConsumedPingsByTeam(db, team.id, now),
		Monitor.estimateConsumedPingsByTeam(db, team.id, now),
	]);

	return {
		consumed: consumedResult.status === "fulfilled" ? consumedResult.value : null,
		usage: usageResult.status === "fulfilled" ? usageResult.value : null,
	};
}

/** GET /app/:team/dashboard/cards/usage — the ping-usage stat card, fragment-only. */
export default createAction(routes.app.team.dashboard.cards.usage, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let { consumed, usage } = await getPingUsage(db, ctx.team);

		if (consumed === null && usage === null) {
			return ctx.render(
				<StatCard
					label={ctx.i18next.t("page.dashboard.error.card.label")}
					value={
						<>
							{ctx.i18next.t("page.dashboard.error.card.value")}
							<Subtitle>{ctx.i18next.t("page.dashboard.error.card.description")}</Subtitle>
						</>
					}
				/>,
			);
		}

		return ctx.render(
			<StatCard
				label={ctx.i18next.t("page.dashboard.stats.monitors.label")}
				value={
					<>
						{consumed === null ? "—" : consumed.toLocaleString()}
						<Subtitle>
							{usage === null
								? ctx.i18next.t("page.dashboard.stats.monitors.unavailable")
								: ctx.i18next.t("page.dashboard.stats.monitors.description", {
										estimated: usage.toLocaleString(),
									})}
						</Subtitle>
					</>
				}
			/>,
		);
	}),
});
