/**
 * Dashboard "Monthly Pings Usage" stat-card fragment controller. GET
 * /app/:team/dashboard/cards/usage — loads just the team's Polar ping usage, with no
 * document shell, so the dashboard's usage `Frame` can swap it in over its skeleton
 * fallback without blocking the rest of the page on Polar's API (the slowest of the
 * dashboard's data fetches). Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Customer from "~/app/data/customer";
import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import DashboardCardUsageView from "~/resources/views/dashboard-card-usage";
import routes from "~/routes/web";

/**
 * Fetches the team's actual Polar ping usage for the current month and, independently,
 * the estimated consumption its current monitor settings project — via
 * `Promise.allSettled` so a failure in either one still lets the other render, rather
 * than discarding both. Gates on the subscription check first (not run in parallel
 * with the other two) so a team with no active subscription never pays for Polar's
 * usage-query latency or the estimate query, only to discard both results. Each
 * resolves to `null` — rendered as "unavailable" by the view — when the team's owner
 * has no active subscription or that specific fetch failed, since "usage unavailable"
 * must never be shown to the user as "0 used".
 */
async function getPingUsage(
	db: Database,
	polar: PolarClient,
	team: { id: string; owner_id: string },
): Promise<{ consumed: number | null; usage: number | null }> {
	let hasActiveSubscription = await Customer.hasActiveSubscription(polar, team.owner_id);
	if (!hasActiveSubscription) return { consumed: null, usage: null };

	let now = new Date();
	let [consumedResult, usageResult] = await Promise.allSettled([
		Customer.getUsagePerMonth(polar, team.owner_id, team.id, now),
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
	handler: inject([Database, PolarClient] as const, async (db, polar) => {
		let ctx = getContext();

		let { consumed, usage } = await getPingUsage(db, polar, ctx.team);

		return ctx.render(<DashboardCardUsageView usage={usage} consumed={consumed} />);
	}),
});
