/**
 * Monitor detail page uptime-history fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/uptime-history — loads the monitor's 90-day
 * daily stats and renders just the status strip, so the monitor page's history `Frame` can
 * load it after the page shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDate, lastNDays } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { StatusStrip } from "@sdxc/ui/app";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { SelectMonitorDailyStats } from "~/database/schema";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { UPTIME_WINDOW_DAYS } from "~/app/models/monitor-daily-stats";
import routes from "~/routes/web";

/**
 * Formats a success share as a percentage with two decimals, or none at a clean 100, so a
 * near-perfect day reads as "99.93" rather than rounding up to a perfect one.
 */
function formatPercentage(successful: number, total: number): string {
	let percentage = (successful / total) * 100;
	return percentage.toFixed(percentage === 100 ? 0 : 2);
}

/** Narrows a stored day's classification to a bar state; anything unrecognised reads as no data. */
function dayStatus(status: string): StatusStrip.Status {
	return status === "up" || status === "degraded" || status === "down" ? status : "no-data";
}

/**
 * GET /app/:team/monitors/:monitorId/cards/uptime-history — the monitor's 90-day status
 * strip, fragment-only. Days are keyed by UTC because `monitor_daily_stats.date` is, and a
 * day with no row is drawn hatched as "no data" rather than as downtime.
 */
export default createAction(routes.app.team.monitors.cards.uptimeHistory, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await ctx.models.monitors.inTeam(ctx.team.id).find(monitorId);
		if (!monitor) return notFound("Not Found");

		let t = ctx.intl.t;
		let dailyStats: SelectMonitorDailyStats[] = await ctx.models.monitorDailyStats.listRecentDays(
			monitor.id,
			"http",
		);
		let byDate = new Map(dailyStats.map((day) => [day.date, day]));
		let days = lastNDays(UPTIME_WINDOW_DAYS, { timeZone: "UTC" });

		let totalChecks = 0;
		let successfulChecks = 0;
		let periods: StatusStrip.Period[] = days.map((day) => {
			let label = formatDate(day.date, { locale: ctx.locale, timeZone: "UTC" });
			let stats = byDate.get(day.key);
			if (!stats || stats.total_checks === 0) {
				return { status: "no-data", label, value: t("page.monitorDetail.history.noData") };
			}

			totalChecks += stats.total_checks;
			successfulChecks += stats.successful_checks;
			return {
				status: dayStatus(stats.status),
				label,
				value: t("page.monitorDetail.history.period", {
					percentage: formatPercentage(stats.successful_checks, stats.total_checks),
					successful: stats.successful_checks,
					total: stats.total_checks,
				}),
			};
		});

		return ctx.render(
			<StatusStrip
				periods={periods}
				label={t("page.monitorDetail.history.label")}
				start={t("statusPage.uptimeBar.daysAgo")}
				end={t("statusPage.uptimeBar.today")}
				summary={
					totalChecks === 0
						? undefined
						: t("statusPage.uptimeBar.tooltip.uptime", {
								percentage: formatPercentage(successfulChecks, totalChecks),
							})
				}
			/>,
		);
	},
});
