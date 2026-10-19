/**
 * API v1 endpoint that re-runs yesterday's daily-stats rollup on demand: enqueues an
 * `aggregateDailyStats` queue message and returns 202 Accepted. The rollup writes every team's
 * stats at once, so the operator's key alone may queue it; it repairs a missed nightly run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { Accepted } from "@sdxc/http/status-code";
import { createAction } from "remix/router";

import { operatorAccess } from "~/app/http/middleware/access";
import requireApiKey from "~/app/http/middleware/require-api-key";
import jobs from "~/app/jobs";
import abilities from "~/app/policies/abilities";
import { apiSuccess } from "~/app/services/api/response";
import routes from "~/routes/web";

/** POST /api/v1/backfill-daily-stats — enqueues the rollup for every team, as the operator. */
export const backfillDailyStatsCreate = createAction(routes.api.v1.backfillDailyStats, {
	middleware: [requireApiKey, operatorAccess, requireAbility(abilities.stats.backfill)],
	handler: async (ctx) => {
		await ctx.jobs.enqueue(jobs.aggregateDailyStats);
		return apiSuccess({ status: "queued" }, Accepted);
	},
});
