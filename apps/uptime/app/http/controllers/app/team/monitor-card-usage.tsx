/**
 * Monitor detail page "Monthly Pings Usage" stat-card fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/usage — loads just this one monitor's ping
 * usage, with no document shell, so the monitor page's usage `Frame` can swap it in
 * over its skeleton fallback without blocking the rest of the page on it. Requires
 * `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { logger } from "@pkg/logger";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/**
 * Reduces one settled figure to the number the card can render, or to `null` for
 * "unavailable" — reporting under `event` every reason it had to give up.
 *
 * The reporting is the point. A monitor that genuinely ran nothing is a fulfilled `0` and
 * renders as `0`; only a failure produces `null`, and `null` renders as a dash. Flattening
 * a rejection without recording it leaves a broken query with no trace anywhere but that
 * dash, on a page nobody watches, which is how the previous version of this card stayed
 * silently broken in production.
 *
 * A fulfilled but non-finite figure is treated the same way: "NaN" reads as a real value
 * to whoever sees it, and "unknown" is the honest answer.
 */
function reportable(
	result: PromiseSettledResult<number>,
	event: string,
	fields: Record<string, string>,
): number | null {
	if (result.status === "fulfilled") {
		if (Number.isFinite(result.value)) return result.value;
		logger.error(event, { ...fields, message: `non-finite value: ${result.value}` });
		return null;
	}

	logger.error(event, {
		...fields,
		message: result.reason instanceof Error ? result.reason.message : String(result.reason),
	});

	return null;
}

/**
 * Counts the pings this monitor has consumed so far this month and, independently,
 * projects the consumption its current interval implies — both from the local check
 * history, in parallel via `Promise.allSettled` so a failure in either one still lets
 * the other render. Each resolves to `null` when its own query failed, since "usage
 * unavailable" must never be shown to the user as "0 used"; a monitor that genuinely
 * ran nothing is a `0` and shows as `0`.
 *
 * Both figures come from this app's own data, so the card is readable regardless of the
 * team's billing state and no subscription check gates it. The consumed figure is
 * therefore what was recorded here rather than what was billed, and it undercounts a
 * month where an aggregation run was lost — see
 * {@link Monitor.countConsumedPingsByMonitor}.
 */
async function getMonitorPingUsage(
	db: Database,
	team: { id: string },
	monitorId: string,
): Promise<{ consumed: number | null; estimated: number | null }> {
	let now = new Date();
	let [consumedResult, estimatedResult] = await Promise.allSettled([
		Monitor.countConsumedPingsByMonitor(db, monitorId, now),
		Monitor.estimateConsumedPingsByMonitor(db, monitorId, now),
	]);

	let fields = { monitorId, teamId: team.id };

	return {
		consumed: reportable(consumedResult, "monitor_usage_card.consumed_unavailable", fields),
		estimated: reportable(estimatedResult, "monitor_usage_card.estimate_unavailable", fields),
	};
}

/** GET /app/:team/monitors/:monitorId/cards/usage — the monitor's ping-usage stat card, fragment-only. */
export default createAction(routes.app.team.monitors.cards.usage, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let usage = await getMonitorPingUsage(db, ctx.team, monitor.id);

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
