/**
 * `GET /health` — a liveness/health-check endpoint used by uptime monitors and
 * load balancers to confirm the worker is running and able to serve requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/http/response/json";
import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

/**
 * Health check endpoint. Always returns `200 OK` with the current status and a
 * timestamp, signalling the service is up.
 *
 * @returns A JSON `200` response `{ status: "ok", timestamp }`.
 * @example
 * router.map(routes.health, health);
 */
export default createAction(routes.health, async () => {
	return ok({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});
