/**
 * DNS monitor detail page results-summary fragment controller. GET
 * /app/:team/dns/:monitorId/cards/results — reduces the monitor's recent check results
 * into the two figures worth a headline, success rate and total checks, with no document
 * shell, so the detail page's summary `Frame` can swap it in over its skeleton fallback.
 *
 * The stat cards live here rather than on the page because both are a reduction over the
 * same result rows: leaving them behind would mean the page paying for the query it was
 * restructured to avoid. The rows themselves are rendered by the check-history fragment,
 * which re-reads them — the summary belongs above the record table and the log below it,
 * and a `Frame` fills only the region it was declared in. Requires `requireUser` +
 * `requireTeam`.
 *
 * There is deliberately no average-response-time card: that figure measures how fast our
 * resolver answered, a property of our infrastructure rather than of the visitor's DNS, so
 * it stays on the individual check where it can explain an outlier.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { flex, flexWrap, gap } from "@pkg/u/layout";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

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
