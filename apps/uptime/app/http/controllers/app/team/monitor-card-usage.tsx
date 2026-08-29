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
import * as s from "remix/data-schema";
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
 * Reduces one settled figure to a renderable number, or logs under `event` and
 * returns `null` for "unavailable". A fulfilled `0` still renders as `0`, while a
 * rejection or a non-finite value is always logged before it renders as a dash.
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
 * Counts consumed pings and projects the interval's implied consumption in
 * parallel via `Promise.allSettled` so either failing still lets the other
 * render; both read from local check history, independent of billing state.
 *
 * @see {@link Monitor.countConsumedPingsByMonitor} for why the consumed figure
 * can undercount when an aggregation run is lost.
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
