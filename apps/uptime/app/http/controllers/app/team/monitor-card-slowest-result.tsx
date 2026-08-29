/**
 * Monitor detail page "Slowest Result" stat-card fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/slowest-result — loads just this one monitor's
 * slowest response time over the last 24 hours from Analytics Engine and returns just
 * the card's markup, so the monitor page's slowest-result `Frame` can swap it in over
 * its skeleton fallback. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getSlowestResultForMonitor } from "~/app/services/analytics";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId/cards/slowest-result — the monitor's slowest-result stat card, fragment-only. */
export default createAction(routes.app.team.monitors.cards.slowestResult, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let result = await getSlowestResultForMonitor(ctx.team.id, monitor.id);
		let slowestResultMs = isFailure(result) ? null : result.data;

		return ctx.render(
			<StatCard
				label={ctx.i18next.t("page.monitor.stats.slowestResult.label")}
				value={
					<>
						{slowestResultMs === null ? "N/A" : `${Math.round(slowestResultMs)}ms`}
						<Subtitle>{ctx.i18next.t("page.monitor.stats.slowestResult.description")}</Subtitle>
					</>
				}
			/>,
		);
	}),
});
