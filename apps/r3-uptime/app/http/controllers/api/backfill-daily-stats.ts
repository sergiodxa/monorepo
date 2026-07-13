/**
 * API v1 endpoint that triggers an on-demand daily-stats rollup: enqueues an
 * `aggregateDailyStats` queue message and returns 202 Accepted. The OLD APP's
 * equivalent route enqueued a `backfillDailyStats` message that no queue consumer on
 * either app ever handled (a dead message, silently dropped) — this uses the real,
 * already-wired `aggregateDailyStats` message type (see `bootstrap/worker.ts`) so the
 * trigger actually does something. Also, unlike the OLD APP's version, this sits
 * behind `requireApiKey` like every other `/api/v1/*` endpoint — the OLD APP left it
 * fully unauthenticated, which let any caller enqueue jobs against the shared queue.
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
