/**
 * DNS monitor detail page results-summary fragment controller: GET
 * /app/:team/dns/:monitorId/cards/results. Reduces checks into success rate and total
 * checks; the query runs once here instead of being repeated by the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { StatCard } from "@sdxc/ui/app";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

/**
 * GET /app/:team/dns/:monitorId/cards/results — the monitor's result-derived stats,
 * fragment-only. A success rate with no checks behind it reads as a dash rather than 0%.
 */
export default createAction(routes.app.team.dnsMonitors.cards.results, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		let results = await ctx.models.dnsMonitorResults.recent(monitor.id);

		let totalChecks = results.length;
		let okChecks = results.filter((result) => result.status === "ok").length;
		let successRate = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : null;

		return ctx.render(
			<StatCard.Group columns={2}>
				<StatCard>
					<StatCard.Label>
						{ctx.intl.t("page.dnsMonitorDetail.stats.successRate.label")}
					</StatCard.Label>
					<StatCard.Value>{successRate === null ? "—" : `${successRate}%`}</StatCard.Value>
				</StatCard>
				<StatCard>
					<StatCard.Label>
						{ctx.intl.t("page.dnsMonitorDetail.stats.totalChecks.label")}
					</StatCard.Label>
					<StatCard.Value>{totalChecks}</StatCard.Value>
				</StatCard>
			</StatCard.Group>,
		);
	},
});
