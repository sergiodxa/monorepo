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
	hasScope,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.alerts.$alertId";

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

// GET /api/v1/alerts/:alertId - Get a specific alert
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.alerts.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		alertId: params.alertId,
	});

	if (!hasScope(apiKey, "alerts:read")) {
		logger().info("api.v1.alerts.get.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: params.alertId,
		});
		throw apiError("FORBIDDEN", "API key does not have alerts:read scope", 403);
	}

	let alert = await db().query.alerts.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.alertId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: {
			id: true,
			name: true,
			notifyOnRecovery: true,
			cooldownMinutes: true,
			config: true,
			monitorId: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (!alert) {
		logger().info("api.v1.alerts.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: params.alertId,
		});
		throw apiError("NOT_FOUND", "Alert not found", 404);
	}

	// Transform config to not expose sensitive data
	let safeAlert = {
		...alert,
		config: {
			strategy: alert.config.strategy,
			...(alert.config.strategy === "email" && {
				to: alert.config.config.to,
				subjectPrefix: alert.config.config.subjectPrefix,
			}),
			...(alert.config.strategy === "slack" && {
				channel: alert.config.config.channel,
			}),
		},
	};

	logger().info("api.v1.alerts.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		alertId: alert.id,
	});

	return apiSuccess({ alert: safeAlert });
}

const updateAlertSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	notifyOnRecovery: z.boolean().optional(),
	cooldownMinutes: z.number().int().min(0).max(1440).optional(),
	monitorId: z.uuid().nullable().optional(),
});

// PUT /api/v1/alerts/:alertId - Update an alert
// DELETE /api/v1/alerts/:alertId - Delete an alert
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.alerts.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		alertId: params.alertId,
		method: request.method,
	});

	if (!hasScope(apiKey, "alerts:write")) {
		logger().info("api.v1.alerts.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: params.alertId,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have alerts:write scope", 403);
	}

	// First verify the alert belongs to this team
	let existingAlert = await db().query.alerts.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.alertId),
				operators.eq(fields.teamId, team.id),
			);
		},
	});

	if (!existingAlert) {
		logger().info("api.v1.alerts.action.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: params.alertId,
			method: request.method,
		});
		throw apiError("NOT_FOUND", "Alert not found", 404);
	}

	if (request.method === "DELETE") {
		await db().delete(schema.alerts).where(eq(schema.alerts.id, params.alertId));

		logger().info("api.v1.alerts.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: params.alertId,
		});

		return apiSuccess({ deleted: true });
	}

	if (request.method === "PUT") {
		let result = await validate(request, updateAlertSchema);
		if (isFailure(result)) {
			logger().info("api.v1.alerts.update.validation-failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				alertId: params.alertId,
				issues: result.error.issues,
			});
			throw apiError("VALIDATION_ERROR", result.error.issues.map((i) => i.message).join(", "), 400);
		}

		// If monitorId is provided and not null, verify it belongs to this team
		if (result.data.monitorId) {
			let monitor = await db().query.monitors.findFirst({
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.id, result.data.monitorId!),
						operators.eq(fields.teamId, team.id),
					);
				},
				columns: { id: true },
			});

			if (!monitor) {
				logger().info("api.v1.alerts.update.monitor-not-found", {
					teamId: team.id,
					apiKeyId: apiKey.id,
					alertId: params.alertId,
					monitorId: result.data.monitorId,
				});
				throw apiError("NOT_FOUND", "Monitor not found", 404);
			}
		}

		let updateData: Partial<schema.InsertAlert> = {};
		if (result.data.name !== undefined) updateData.name = result.data.name;
		if (result.data.notifyOnRecovery !== undefined)
			updateData.notifyOnRecovery = result.data.notifyOnRecovery;
		if (result.data.cooldownMinutes !== undefined)
			updateData.cooldownMinutes = result.data.cooldownMinutes;
		if (result.data.monitorId !== undefined) updateData.monitorId = result.data.monitorId;

		let [alert] = await db()
			.update(schema.alerts)
			.set(updateData)
			.where(eq(schema.alerts.id, params.alertId))
			.returning();

		if (!alert) {
			logger().error("api.v1.alerts.update.failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				alertId: params.alertId,
			});
			throw apiError("INTERNAL_ERROR", "Failed to update alert", 500);
		}

		logger().info("api.v1.alerts.update.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: alert.id,
		});

		return apiSuccess({
			alert: {
				id: alert.id,
				name: alert.name,
				notifyOnRecovery: alert.notifyOnRecovery,
				cooldownMinutes: alert.cooldownMinutes,
				monitorId: alert.monitorId,
				config: { strategy: alert.config.strategy },
				createdAt: alert.createdAt,
				updatedAt: alert.updatedAt,
			},
		});
	}

	logger().info("api.v1.alerts.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		alertId: params.alertId,
		method: request.method,
	});
	throw apiError("METHOD_NOT_ALLOWED", "Only GET, PUT, and DELETE methods are allowed", 405);
}
