/**
 * DNS monitor detail page uptime-history fragment controller. GET
 * /app/:team/dns/:monitorId/cards/uptime-history — loads just this one monitor's last
 * 90 days of daily stats and draws them as a status strip, with no document shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/middleware/async-context";

import { formatDate, lastNDays } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { m } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";
import { StatusStrip } from "@sdxc/ui/app";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { SelectMonitorDailyStats } from "~/database/schema";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { UPTIME_WINDOW_DAYS } from "~/app/models/monitor-daily-stats";
import routes from "~/routes/web";

/** The strip status each recorded day status draws as. */
const DAY_STATUS: Record<string, StatusStrip.Status> = {
	up: "up",
	degraded: "degraded",
	down: "down",
};

/**
 * One strip period per UTC day of the window, oldest first. Days are keyed by the UTC day
 * `monitor_daily_stats.date` uses, and a day with no row reads as no data rather than as down.
 */
function uptimePeriods(
	days: readonly SelectMonitorDailyStats[],
	intl: ReturnType<typeof getContext>["intl"],
	locale: string,
): StatusStrip.Period[] {
	let byDate = new Map(days.map((day) => [day.date, day]));

	return lastNDays(UPTIME_WINDOW_DAYS, { timeZone: "UTC" }).map(({ key }): StatusStrip.Period => {
		let day = byDate.get(key);
		let label = formatDate(new Date(`${key}T00:00:00Z`), { locale, timeZone: "UTC" });
		if (!day || day.total_checks === 0) {
			return { status: "no-data", label, value: intl.t("statusPage.uptimeBar.tooltip.noData") };
		}
		return {
			status: DAY_STATUS[day.status] ?? "no-data",
			label,
			value: intl.t("statusPage.uptimeBar.tooltip.uptime", {
				percentage: uptimePercentage(day.successful_checks, day.total_checks),
			}),
		};
	});
}

/** A success ratio as the caption prints it: whole at 100%, two decimals otherwise. */
function uptimePercentage(successful: number, total: number): string {
	let percentage = (successful / total) * 100;
	return percentage.toFixed(percentage === 100 ? 0 : 2);
}

/**
 * GET /app/:team/dns/:monitorId/cards/uptime-history — the monitor's 90-day status strip,
 * fragment-only. The summary totals the window's checks, so a busy day weighs more than a
 * quiet one, and it is left out until the window holds a check.
 */
export default createAction(routes.app.team.dnsMonitors.cards.uptimeHistory, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(monitorId);
		if (!monitor) return notFound("Not Found");

		let dailyStats = await ctx.models.monitorDailyStats.listRecentDays(monitor.id, "dns");
		let periods = uptimePeriods(dailyStats, ctx.intl, ctx.locale);
		let windowKeys = new Set(
			lastNDays(UPTIME_WINDOW_DAYS, { timeZone: "UTC" }).map((day) => day.key),
		);
		let inWindow = dailyStats.filter((day) => windowKeys.has(day.date));
		let total = inWindow.reduce((sum, day) => sum + day.total_checks, 0);
		let successful = inWindow.reduce((sum, day) => sum + day.successful_checks, 0);

		return ctx.render(
			<section>
				<h2 mix={[m(0), fontSize("md"), weight("semibold")]}>
					{ctx.intl.t("page.dnsMonitorDetail.uptimeHistory")}
				</h2>
				<StatusStrip
					periods={periods}
					label={ctx.intl.t("page.dnsMonitorDetail.uptimeHistory")}
					start={ctx.intl.t("statusPage.uptimeBar.daysAgo")}
					end={ctx.intl.t("statusPage.uptimeBar.today")}
					summary={
						total === 0
							? undefined
							: ctx.intl.t("statusPage.uptimeBar.tooltip.uptime", {
									percentage: uptimePercentage(successful, total),
								})
					}
				/>
			</section>,
		);
	},
});
