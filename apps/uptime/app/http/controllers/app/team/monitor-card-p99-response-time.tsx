/**
 * Monitor detail page "P99 Response Time" stat-card fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/p99-response-time — loads just this one monitor's
 * 99th-percentile response time over the last 24 hours from Analytics Engine, with no
 * document shell, so the monitor page's p99 `Frame` can swap it in over its skeleton
 * fallback. Requires `requireUser` + `requireTeam`.
 *
 * Calls `getHttpP99ResponseTime` directly, so the card pays for exactly one Analytics
 * Engine query, separate from `Monitor.getStatsById`'s combined D1 aggregate query.
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
import { getHttpP99ResponseTime } from "~/app/services/analytics";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId/cards/p99-response-time — the monitor's p99 stat card, fragment-only. */
export default createAction(routes.app.team.monitors.cards.p99ResponseTime, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		/**
		 * An em dash covers both "no HTTP checks in the last 24 hours" (`null`) and "the
		 * Analytics Engine query failed" — the p99 is this card's only figure, so a
		 * missing number renders as a placeholder, keeping the fragment's response intact.
		 */
		let result = await getHttpP99ResponseTime({ monitorId: monitor.id });
		let p99ResponseTimeMs = isFailure(result) ? null : result.data;

		return ctx.render(
			<StatCard
				label={ctx.i18next.t("page.monitor.stats.p99ResponseTime.label")}
				value={
					<>
						{p99ResponseTimeMs === null
							? "—"
							: ctx.i18next.t("page.monitor.stats.p99ResponseTime.value", {
									value: Math.round(p99ResponseTimeMs),
								})}
						<Subtitle>{ctx.i18next.t("page.monitor.stats.p99ResponseTime.description")}</Subtitle>
					</>
				}
			/>,
		);
	}),
});
