/**
 * Download a flow run's Chrome Performance trace from R2.
 * GET /app/:team/flows/:monitorId/results/:resultId/trace
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { flowTraces, readFlowTrace } from "~/app/models/flow-traces";
import routes from "~/routes/web";

/** GET — stream the chrome://tracing JSON for one result, when it is still stored. */
export default createAction(routes.app.team.flowMonitors.trace, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let params = s.parse(s.object({ monitorId: s.string(), resultId: s.string() }), ctx.params);

		let monitor = await ctx.models.flowMonitors
			.inTeam(ctx.team.id)
			.where({ id: params.monitorId })
			.first();
		if (!monitor) return notFound("Not Found");

		let result = await ctx.models.flowMonitorResults
			.forMonitor(monitor.id)
			.where({ id: params.resultId })
			.first();
		if (!result || result.trace_key === null) {
			return notFound(ctx.intl.t("page.flowMonitorDetail.trace.missing"));
		}

		let bytes = await readFlowTrace(flowTraces(), result.trace_key);
		if (bytes === null) {
			return notFound(ctx.intl.t("page.flowMonitorDetail.trace.expired"));
		}

		let filename = `${sanitize(monitor.name)}-${params.resultId}.json`;
		let body = new Uint8Array(bytes.byteLength);
		body.set(bytes);
		return new Response(body, {
			status: 200,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Cache-Control": "private, no-store",
			},
		});
	},
});

/** A filename segment safe for Content-Disposition. */
function sanitize(name: string): string {
	let cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
	return cleaned === "" ? "flow" : cleaned;
}
