/**
 * Monitor detail page "P99 Response Time" stat-card fragment controller. GET
 * /app/:team/monitors/:monitorId/cards/p99-response-time — loads just this one monitor's
 * 99th-percentile response time over the last 24 hours from Analytics Engine, with no
 * document shell, so the monitor page's p99 `Frame` can swap it in over its skeleton
 * fallback. Requires `requireUser` + `requireTeam`.
 *
 * Calls `getHttpP99ResponseTime` directly rather than `Monitor.getStatsById` so the card
 * pays for one Analytics Engine query and none of the D1 aggregate that method also runs
 * for figures this card doesn't render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

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
		 * Analytics Engine query failed" — the p99 is the only figure on this card, so a
		 * missing number degrades to a placeholder rather than taking the fragment down.
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
