/**
 * DNS monitor detail page uptime-history fragment controller. GET
 * /app/:team/dns/:monitorId/cards/uptime-history — loads just this one monitor's last
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
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import DnsMonitor from "~/app/data/dns-monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import UptimeBar from "~/resources/views/shared/uptime-bar";
import routes from "~/routes/web";

/** GET /app/:team/dns/:monitorId/cards/uptime-history — the monitor's 90-day uptime bar, fragment-only. */
export default createAction(routes.app.team.dnsMonitors.cards.uptimeHistory, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let dailyStats = await MonitorDailyStats.listRecentDays(db, monitor.id, "dns");

		// The bar's copy is the same copy a viewer reads on a public status page, so it
		// reuses those keys rather than growing a second set that could drift from them.
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
				<h2>{ctx.i18next.t("page.dnsMonitorDetail.uptimeHistory")}</h2>
				{/* 90 bars at a 2px floor plus their gaps need ~358px, more than this column
				offers on a phone, so the bar gets its own scroll box rather than pushing the
				whole content area sideways. */}
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
