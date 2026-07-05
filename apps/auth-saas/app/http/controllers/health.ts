import { ok } from "@pkg/http/response/json";
import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

/**
 * Health check endpoint.
 * Returns 200 OK if the service is running.
 */
export default createAction(routes.health, async () => {
	return ok({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});
