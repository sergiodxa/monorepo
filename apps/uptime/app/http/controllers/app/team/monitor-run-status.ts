/**
 * Monitor detail page run-status probe. GET /app/:team/monitors/:monitorId/run-status —
 * answers with the monitor row's cached `last_status`/`last_checked_at` as JSON, nothing
 * else, so a hydrated page can poll it cheaply after starting an on-demand run and notice
 * the moment a queued check commits its result. Requires `requireUser` + `requireTeam`,
 * and 404s for a monitor outside the current team like every other detail-page route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound, ok } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Monitor from "~/app/data/monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId/run-status — the monitor's last check outcome, as JSON. */
export default createAction(routes.app.team.monitors.runStatus, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound({ error: "Not Found" });

		return ok({ status: monitor.last_status, checkedAt: monitor.last_checked_at });
	}),
});
