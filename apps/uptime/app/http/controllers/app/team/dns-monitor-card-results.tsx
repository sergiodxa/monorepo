/**
 * DNS monitor detail page results-summary fragment controller: GET
 * /app/:team/dns/:monitorId/cards/results. Reduces checks into success rate and total
 * checks; the query runs once here instead of being repeated by the page. Response time
 * stays on the individual check, since resolver speed, not the monitored DNS record,
 * drives that figure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import { flex, flexWrap, gap } from "@sdxc/u/layout";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import DnsMonitor from "~/app/data/dns-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import StatCard from "~/resources/components/stat-card";
import routes from "~/routes/web";

/** GET /app/:team/dns/:monitorId/cards/results — the monitor's result-derived stats, fragment-only. */
export default createAction(routes.app.team.dnsMonitors.cards.results, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await DnsMonitor.listResults(db, monitor.id);

		let totalChecks = results.length;
		let okChecks = results.filter((result) => result.status === "ok").length;
		let successRate = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : null;

		return ctx.render(
			<div mix={[flex(), flexWrap(), gap("16px")]}>
				<StatCard
					label={ctx.i18next.t("page.dnsMonitorDetail.stats.successRate.label")}
					value={successRate === null ? "—" : `${successRate}%`}
				/>
				<StatCard
					label={ctx.i18next.t("page.dnsMonitorDetail.stats.totalChecks.label")}
					value={totalChecks}
				/>
			</div>,
		);
	}),
});
