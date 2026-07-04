import { ok } from "@pkg/http/response/json";

import action from "~/app/lib/action";

/**
 * Health check endpoint.
 * Returns 200 OK if the service is running.
 */
export default action<"GET", "/health">(async () => {
	return ok({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});
