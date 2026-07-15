/**
 * Monitor detail page calendar-year uptime heatmap fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/heatmap — loads just this one monitor's daily
 * stats for the current calendar year and renders the `Heatmap` grid, with no document
 * shell, so the monitor page's heatmap `Frame` can swap it in over its skeleton
 * fallback. Fetches `MonitorDailyStats.listForCurrentYear` independently of the uptime
 * card fragment's own identical fetch — duplicated on purpose since each `Frame` loads
 * independently, matching the dashboard cards' convention. Requires `requireUser` +
 * `requireTeam`.
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
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId/cards/heatmap — the monitor's calendar-year uptime heatmap, fragment-only. */
export default createAction(routes.app.team.monitors.cards.heatmap, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "http");

		return ctx.render(<Heatmap days={dailyStats} />);
	}),
});
