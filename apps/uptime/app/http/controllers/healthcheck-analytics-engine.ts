/**
 * Health check controller for the Analytics Engine dependency. Responds `503` only
 * when the write binding itself is missing; a failed read-API probe reports
 * `200 { status: "degraded" }` rather than `503`, since writes still work and the
 * dashboard falls back gracefully (see `app/services/analytics.ts`'s `isFailure`
 * handling throughout). It exists as a separate uptime target from `/healthcheck`
 * because Analytics Engine and D1 are independent dependencies that can fail without
 * each other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok, serviceUnavailable } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { queryAnalytics } from "~/app/services/analytics";
import routes from "~/routes/web";

/** GET /healthcheck/analytics-engine — verifies the PING_RESULTS binding and its read API. */
export default createAction(routes.healthcheckAnalyticsEngine, async () => {
	if (typeof env.PING_RESULTS?.writeDataPoint !== "function") {
		return serviceUnavailable({
			status: "error",
			message: "Analytics Engine binding (PING_RESULTS) not configured",
		});
	}

	let result = await queryAnalytics<{ count: number }>(
		"SELECT count() as count FROM uptime_monitor_results LIMIT 1",
	);

	if (isFailure(result)) {
		return ok({
			status: "degraded",
			binding: true,
			apiConnected: false,
			eventCount: null,
			message: `Write binding available, but read API failed: ${result.error.message}`,
		});
	}

	let eventCount = result.data[0]?.count ?? 0;
	return ok({
		status: "ok",
		binding: true,
		apiConnected: true,
		eventCount,
		message: `Analytics Engine connected, ${eventCount} events recorded`,
	});
});
