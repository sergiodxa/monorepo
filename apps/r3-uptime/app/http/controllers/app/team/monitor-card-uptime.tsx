/**
 * Monitor detail page "Uptime percentage" stat-card fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/uptime — loads just this one monitor's daily
 * stats for the current calendar year and reduces them into an overall uptime
 * percentage, with no document shell, so the monitor page's uptime `Frame` can swap it
 * in over its skeleton fallback. Fetches `MonitorDailyStats.listForCurrentYear`
 * independently of the heatmap fragment's own identical fetch — duplicated on purpose
 * since each `Frame` loads independently, matching the dashboard cards' convention.
 * Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId/cards/uptime — the monitor's uptime-percentage stat card, fragment-only. */
export default createAction(routes.app.team.monitors.cards.uptime, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "http");
		let totalChecks = dailyStats.reduce((sum, day) => sum + day.total_checks, 0);
		let successfulChecks = dailyStats.reduce((sum, day) => sum + day.successful_checks, 0);
		let uptimePercent = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 100) : null;

		return ctx.render(
			<StatCard
				label={ctx.i18next.t("page.monitor.stats.uptime.label")}
				value={
					<>
						{uptimePercent === null ? "—" : `${uptimePercent}%`}
						<Subtitle>{ctx.i18next.t("page.monitor.stats.uptime.description")}</Subtitle>
					</>
				}
			/>,
		);
	}),
});
