import { desc, eq } from "drizzle-orm";

import * as schema from "~/db/schema";
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

import type { Route } from "./+types/v1.status";

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

// GET /api/v1/status - Get overall team status
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.status.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "monitors:read")) {
		logger().info("api.v1.status.get.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:read scope", 403);
	}

	// Get all monitors for this team
	let monitors = await db().query.monitors.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			expectedStatus: true,
			enabledAt: true,
		},
	});

	// Get the latest result for each monitor
	let monitorStatuses = await Promise.all(
		monitors.map(async (monitor) => {
			let [latestResult] = await db()
				.select({
					responseStatus: schema.monitorResults.responseStatus,
					responseTimeMs: schema.monitorResults.responseTimeMs,
					completedAt: schema.monitorResults.completedAt,
				})
				.from(schema.monitorResults)
				.where(eq(schema.monitorResults.monitorId, monitor.id))
				.orderBy(desc(schema.monitorResults.completedAt))
				.limit(1);

			let status: "up" | "down" | "degraded" | "unknown" = "unknown";
			if (latestResult?.responseStatus !== null && latestResult?.responseStatus !== undefined) {
				if (latestResult.responseStatus === monitor.expectedStatus) {
					status = "up";
				} else {
					status = "down";
				}
			}

			return {
				id: monitor.id,
				name: monitor.name,
				status,
				enabled: monitor.enabledAt !== null,
				lastCheck: latestResult?.completedAt ?? null,
				responseTimeMs: latestResult?.responseTimeMs ?? null,
			};
		}),
	);

	// Calculate overall status
	let enabledMonitors = monitorStatuses.filter((m) => m.enabled);
	let downMonitors = enabledMonitors.filter((m) => m.status === "down");
	// Note: degraded status is not currently tracked but reserved for future use
	let degradedMonitors: typeof enabledMonitors = [];

	let overallStatus: "operational" | "degraded" | "partial_outage" | "major_outage" | "unknown";

	if (enabledMonitors.length === 0) {
		overallStatus = "unknown";
	} else if (downMonitors.length === enabledMonitors.length) {
		overallStatus = "major_outage";
	} else if (downMonitors.length > 0) {
		overallStatus = "partial_outage";
	} else if (degradedMonitors.length > 0) {
		overallStatus = "degraded";
	} else {
		overallStatus = "operational";
	}

	logger().info("api.v1.status.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		overallStatus,
		monitorsCount: monitors.length,
	});

	return apiSuccess({
		status: {
			overall: overallStatus,
			monitors: monitorStatuses,
			summary: {
				total: monitors.length,
				up: monitorStatuses.filter((m) => m.status === "up").length,
				down: downMonitors.length,
				degraded: degradedMonitors.length,
				unknown: monitorStatuses.filter((m) => m.status === "unknown").length,
			},
		},
	});
}
