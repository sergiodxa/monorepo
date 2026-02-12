import { eq } from "drizzle-orm";

import type { SelectMaintenanceWindow } from "~/db/schema";

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

import type { Route } from "./+types/v1.maintenance.$maintenanceId.end";

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

function serializeMaintenanceWindow(window: SelectMaintenanceWindow) {
	return {
		id: window.id,
		teamId: window.teamId,
		monitorId: window.monitorId,
		name: window.name,
		startsAt: window.startsAt,
		endsAt: window.endsAt,
		endedEarlyAt: window.endedEarlyAt,
		suppressAlerts: window.suppressAlerts,
		showOnStatusPage: window.showOnStatusPage,
		createdAt: window.createdAt,
		updatedAt: window.updatedAt,
	};
}

// POST /api/v1/maintenance/:maintenanceId/end - End maintenance early
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.maintenance.end.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		maintenanceWindowId: params.maintenanceId,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.maintenance.end.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
	}

	if (!hasScope(apiKey, "maintenance:write")) {
		logger().info("api.v1.maintenance.end.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
		});
		throw apiError("FORBIDDEN", "API key does not have maintenance:write scope", 403);
	}

	let existingMaintenanceWindow = await db().query.maintenanceWindows.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.maintenanceId),
				operators.eq(fields.teamId, team.id),
			);
		},
	});

	if (!existingMaintenanceWindow) {
		logger().info("api.v1.maintenance.end.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
		});
		throw apiError("NOT_FOUND", "Maintenance window not found", 404);
	}

	let now = new Date();

	let [maintenanceWindow] = await db()
		.update(schema.maintenanceWindows)
		.set({ endedEarlyAt: now })
		.where(eq(schema.maintenanceWindows.id, params.maintenanceId))
		.returning();

	if (!maintenanceWindow) {
		logger().error("api.v1.maintenance.end.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
		});
		throw apiError("INTERNAL_ERROR", "Failed to end maintenance window", 500);
	}

	logger().info("api.v1.maintenance.end.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		maintenanceWindowId: maintenanceWindow.id,
		endedEarlyAt: maintenanceWindow.endedEarlyAt,
	});

	return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(maintenanceWindow) });
}
