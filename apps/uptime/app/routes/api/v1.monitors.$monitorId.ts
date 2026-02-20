import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	BadRequest,
	Forbidden,
	hasScope,
	InternalServerError,
	MethodNotAllowed,
	NotFound,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.monitors.$monitorId";

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

// GET /api/v1/monitors/:monitorId - Get a specific monitor
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
	});

	if (!hasScope(apiKey, "monitors:read")) {
		logger().info("api.v1.monitors.get.forbidden", {
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
		columns: {
			id: true,
			name: true,
			url: true,
			method: true,
			expectedStatus: true,
			intervalSeconds: true,
			degradedAfterMs: true,
			timeoutSeconds: true,
			locationHint: true,
			enabledAt: true,
			sslMonitoringEnabled: true,
			sslExpiryWarningDays: true,
			sslExpiresAt: true,
			sslIssuer: true,
			sslStatus: true,
			sslLastCheckedAt: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (!monitor) {
		logger().info("api.v1.monitors.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("NOT_FOUND", "Monitor not found", NotFound);
	}

	logger().info("api.v1.monitors.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: monitor.id,
	});

	return apiSuccess({ monitor });
}

const updateMonitorSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	url: z.url().optional(),
	method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).optional(),
	expectedStatus: z.number().int().min(100).max(599).optional(),
	intervalSeconds: z.number().int().min(60).max(3600).optional(),
	degradedAfterMs: z.number().int().min(1000).max(30000).optional(),
	timeoutSeconds: z.number().int().min(1).max(60).optional(),
	locationHint: z
		.enum(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"])
		.optional(),
	enabled: z.boolean().optional(),
	sslMonitoringEnabled: z.boolean().optional(),
	sslExpiryWarningDays: z.number().int().min(1).max(365).optional(),
});

// PUT /api/v1/monitors/:monitorId - Update a monitor
// DELETE /api/v1/monitors/:monitorId - Delete a monitor
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		method: request.method,
	});

	if (!hasScope(apiKey, "monitors:write")) {
		logger().info("api.v1.monitors.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:write scope", Forbidden);
	}

	// First verify the monitor belongs to this team
	let existingMonitor = await db().query.monitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.monitorId),
				operators.eq(fields.teamId, team.id),
			);
		},
	});

	if (!existingMonitor) {
		logger().info("api.v1.monitors.action.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
			method: request.method,
		});
		throw apiError("NOT_FOUND", "Monitor not found", NotFound);
	}

	if (request.method === "DELETE") {
		await db().delete(schema.monitors).where(eq(schema.monitors.id, params.monitorId));

		logger().info("api.v1.monitors.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});

		return apiSuccess({ deleted: true });
	}

	if (request.method === "PUT") {
		let result = await validate(request, updateMonitorSchema);
		if (isFailure(result)) {
			logger().info("api.v1.monitors.update.validation-failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				monitorId: params.monitorId,
				issues: result.error.issues,
			});
			throw apiError(
				"VALIDATION_ERROR",
				result.error.issues.map((i) => i.message).join(", "),
				BadRequest,
			);
		}

		let updateData: Partial<schema.InsertMonitor> = {};
		if (result.data.name !== undefined) updateData.name = result.data.name;
		if (result.data.url !== undefined) updateData.url = result.data.url;
		if (result.data.method !== undefined) updateData.method = result.data.method;
		if (result.data.expectedStatus !== undefined)
			updateData.expectedStatus = result.data.expectedStatus;
		if (result.data.intervalSeconds !== undefined)
			updateData.intervalSeconds = result.data.intervalSeconds;
		if (result.data.degradedAfterMs !== undefined)
			updateData.degradedAfterMs = result.data.degradedAfterMs;
		if (result.data.timeoutSeconds !== undefined)
			updateData.timeoutSeconds = result.data.timeoutSeconds;
		if (result.data.locationHint !== undefined) updateData.locationHint = result.data.locationHint;
		if (result.data.enabled !== undefined) {
			updateData.enabledAt = result.data.enabled ? new Date() : null;
		}
		if (result.data.sslMonitoringEnabled !== undefined)
			updateData.sslMonitoringEnabled = result.data.sslMonitoringEnabled;
		if (result.data.sslExpiryWarningDays !== undefined)
			updateData.sslExpiryWarningDays = result.data.sslExpiryWarningDays;

		let [monitor] = await db()
			.update(schema.monitors)
			.set(updateData)
			.where(eq(schema.monitors.id, params.monitorId))
			.returning();

		if (!monitor) {
			logger().error("api.v1.monitors.update.failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				monitorId: params.monitorId,
			});
			throw apiError("INTERNAL_ERROR", "Failed to update monitor", InternalServerError);
		}

		logger().info("api.v1.monitors.update.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: monitor.id,
		});

		return apiSuccess({ monitor });
	}

	logger().info("api.v1.monitors.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		method: request.method,
	});
	throw apiError(
		"METHOD_NOT_ALLOWED",
		"Only GET, PUT, and DELETE methods are allowed",
		MethodNotAllowed,
	);
}
