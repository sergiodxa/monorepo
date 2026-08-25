/**
 * TCP monitor detail page uptime-history fragment controller. GET
 * /app/:team/tcp/:monitorId/cards/uptime-history — loads just this one monitor's last
 * 90 days of daily stats and renders the shared uptime bar, with no document shell, so
 * the detail page's history `Frame` can swap it in over its skeleton fallback and the
 * page shell never waits on the rollup table. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { overflowX } from "@pkg/u/overflow";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import UptimeBar from "~/resources/views/shared/uptime-bar";
import routes from "~/routes/web";

/**
 * GET /app/:team/tcp/:monitorId/cards/uptime-history — the monitor's 90-day
 * uptime bar, fragment-only, inside a horizontally scrolling box since 90
 * bars need roughly 358px, wider than a typical phone column.
 */
export default createAction(routes.app.team.tcpMonitors.cards.uptimeHistory, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let dailyStats = await MonitorDailyStats.listRecentDays(db, monitor.id, "tcp");

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
			<section>
				<h2>{ctx.i18next.t("page.tcpMonitorDetail.history.title")}</h2>
				<div mix={[overflowX("auto")]}>
					<UptimeBar
						days={dailyStats}
						labels={labels}
						formatUptime={(percentage) =>
							ctx.i18next.t("statusPage.uptimeBar.tooltip.uptime", { percentage })
						}
					/>
				</div>
			</section>,
		);
	}),
});
