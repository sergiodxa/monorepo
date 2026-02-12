import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	hasScope,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Monitor from "~/models/monitor";

import type { Route } from "./+types/v1.monitors.$monitorId.stats";

export const middleware: Route.MiddlewareFunction[] = [
	async ({ request, context }, next) => {
		let auth = await verifyApiKey(request);
		if (!auth) {
			throw apiError("UNAUTHORIZED", "Invalid or missing API key", 401);
		}
		context.set(ApiAuthContext, auth);
		return await next();
	},
];

// GET /api/v1/monitors/:monitorId/stats - Get stats for a monitor
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.stats.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
	});

	if (!hasScope(apiKey, "monitors:read")) {
		logger().info("api.v1.monitors.stats.get.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:read scope", 403);
	}

	let monitor = await db().query.monitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.monitorId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: { id: true },
	});

	if (!monitor) {
		logger().info("api.v1.monitors.stats.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("NOT_FOUND", "Monitor not found", 404);
	}

	let stats = await Monitor.getStatsById(db(), monitor.id);

	logger().info("api.v1.monitors.stats.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: monitor.id,
	});

	return apiSuccess({ stats });
}
