import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	Forbidden,
	hasScope,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Monitor from "~/models/monitor";

import type { Route } from "./+types/v1.monitors.stats";

export const middleware: Route.MiddlewareFunction[] = [
	async ({ request, context }, next) => {
		let auth = await verifyApiKey(request);
		if (!auth) {
			throw apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);
		}
		context.set(ApiAuthContext, auth);
		return await next();
	},
];

// GET /api/v1/monitors/stats - Get stats for all monitors in team
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.stats.team.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "monitors:read")) {
		logger().info("api.v1.monitors.stats.team.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:read scope", Forbidden);
	}

	let stats = await Monitor.getStatsByTeamId(db(), team.id);

	logger().info("api.v1.monitors.stats.team", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	return apiSuccess({ stats });
}
