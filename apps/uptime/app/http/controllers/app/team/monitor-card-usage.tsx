/**
 * Monitor detail page "Monthly Pings Usage" stat-card fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/usage — loads just this one monitor's Polar
 * ping usage, with no document shell, so the monitor page's usage `Frame` can swap it
 * in over its skeleton fallback without blocking the rest of the page on Polar's API
 * (the slowest of the monitor page's data fetches). Requires `requireUser` +
 * `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Customer from "~/app/data/customer";
import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/**
 * Fetches one monitor's own Polar ping usage for the current month and its
 * interval-projected estimate, independently via `Promise.allSettled` so a failure in
 * either one still lets the other render. Resolves to `null` when the team has no
 * active subscription or that specific fetch failed, since "usage unavailable" must
 * never be shown to the user as "0 used" — matches the dashboard usage card's own
 * convention for the exact same figures, scoped down to one monitor.
 */
async function getMonitorPingUsage(
	db: Database,
	polar: PolarClient,
	team: { id: string; owner_id: string },
	monitorId: string,
): Promise<{ consumed: number | null; estimated: number | null }> {
	let hasActiveSubscription = await Customer.hasActiveSubscription(polar, team.owner_id);
	if (!hasActiveSubscription) return { consumed: null, estimated: null };

	let now = new Date();
	let [consumedResult, estimatedResult] = await Promise.allSettled([
		Customer.getUsagePerMonthForMonitor(polar, team.owner_id, monitorId, now),
		Monitor.estimateConsumedPingsByMonitor(db, monitorId, now),
	]);

	return {
		consumed: consumedResult.status === "fulfilled" ? consumedResult.value : null,
		estimated: estimatedResult.status === "fulfilled" ? estimatedResult.value : null,
	};
}

/** GET /app/:team/monitors/:monitorId/cards/usage — the monitor's ping-usage stat card, fragment-only. */
export default createAction(routes.app.team.monitors.cards.usage, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database, PolarClient] as const, async (db, polar) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let usage = await getMonitorPingUsage(db, polar, ctx.team, monitor.id);

		return ctx.render(
			<StatCard
				label={ctx.i18next.t("page.monitor.stats.monitors.label")}
				value={
					<>
						{usage.consumed === null ? "—" : usage.consumed.toLocaleString()}
						<Subtitle>
							{usage.estimated === null
								? ctx.i18next.t("page.monitor.stats.monitors.estimateUnavailable")
								: ctx.i18next.t("page.monitor.stats.monitors.description", {
										estimated: usage.estimated.toLocaleString(),
									})}
						</Subtitle>
					</>
				}
			/>,
		);
	}),
});
