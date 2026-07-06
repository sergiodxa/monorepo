/**
 * API route serving read-only aggregate statistics for a single HTTP monitor.
 * Its loader authenticates the request via API key, enforces the monitors:read
 * scope, confirms the monitor belongs to the caller's team, and returns the
 * computed stats. It exists to power dashboards and programmatic monitor reporting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	Forbidden,
	hasScope,
	NotFound,
	Unauthorized,
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
			throw apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);
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
		throw apiError("FORBIDDEN", "API key does not have monitors:read scope", Forbidden);
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
		throw apiError("NOT_FOUND", "Monitor not found", NotFound);
	}

	let stats = await Monitor.getStatsById(db(), monitor.id);

	logger().info("api.v1.monitors.stats.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: monitor.id,
	});

	return apiSuccess({ stats });
}
