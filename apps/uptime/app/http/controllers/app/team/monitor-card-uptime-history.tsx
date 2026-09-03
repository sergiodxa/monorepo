/**
 * Monitor detail page uptime-history fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/uptime-history — loads the monitor's 90-day
 * daily stats and renders just the uptime bar, so the monitor page's history `Frame`
 * can swap it in over its skeleton. Fetches its stats independently since each `Frame`
 * loads on its own. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import { overflowX } from "@sdxc/u/overflow";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import UptimeBar from "~/resources/views/shared/uptime-bar";
import routes from "~/routes/web";

/**
 * GET /app/:team/monitors/:monitorId/cards/uptime-history — the monitor's 90-day
 * uptime bar, fragment-only. Shares its copy keys with the public status page's bar and
 * gives the 90-bar strip its own horizontal scroll box to fit a phone-width column.
 */
export default createAction(routes.app.team.monitors.cards.uptimeHistory, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let dailyStats = await MonitorDailyStats.listRecentDays(db, monitor.id, "http");

		let labels = {
			daysAgo: ctx.i18next.t("statusPage.uptimeBar.daysAgo"),
			today: ctx.i18next.t("statusPage.uptimeBar.today"),
			legend: {
				full: ctx.i18next.t("statusPage.uptimeBar.legend.full"),
				partial: ctx.i18next.t("statusPage.uptimeBar.legend.partial"),
				down: ctx.i18next.t("statusPage.uptimeBar.legend.down"),
				noData: ctx.i18next.t("statusPage.uptimeBar.legend.noData"),
			},
		};

		return ctx.render(
			<div mix={[overflowX("auto")]}>
				<UptimeBar
					days={dailyStats}
					labels={labels}
					formatUptime={(percentage) =>
						ctx.i18next.t("statusPage.uptimeBar.tooltip.uptime", { percentage })
					}
				/>
			</div>,
		);
	}),
});
