/**
 * API v1 endpoint that triggers an on-demand daily-stats rollup: enqueues an
 * `aggregateDailyStats` queue message (see `bootstrap/worker.ts` for the consumer
 * that handles it) and returns 202 Accepted. Sits behind `requireApiKey`, like every
 * other `/api/v1/*` endpoint, since without authentication any caller could enqueue
 * jobs against the shared queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Accepted } from "@pkg/http/status-code";
import { env } from "cloudflare:workers";
import { createAction } from "remix/fetch-router";

import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** POST /api/v1/backfill-daily-stats — enqueues a daily-stats rollup. */
export const backfillDailyStatsCreate = createAction(routes.api.v1.backfillDailyStats, {
	middleware: [requireApiKey("monitors:write")],
	handler: async () => {
		await env.QUEUE.send({ type: "aggregateDailyStats" });
		return apiSuccess({ status: "queued" }, Accepted);
	},
});
