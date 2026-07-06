/**
 * API v1 item endpoint for a single maintenance window: an API-key middleware
 * authenticates the request, the loader fetches one window scoped to the team
 * (maintenance:read), and the action updates or deletes it (maintenance:write),
 * re-validating dates and any referenced monitor. It exists to read, edit, and remove
 * individual maintenance windows over the public API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import type { SelectMaintenanceWindow } from "~/db/schema";

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

import type { Route } from "./+types/v1.maintenance.$maintenanceId";

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

const isoDateString = z.string().datetime();

const updateMaintenanceSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		monitorId: z.string().uuid().optional().nullable(),
		startsAt: isoDateString.transform((value) => new Date(value)).optional(),
		endsAt: isoDateString.transform((value) => new Date(value)).optional(),
		suppressAlerts: z.boolean().optional(),
		showOnStatusPage: z.boolean().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
			ctx.addIssue({
				code: "custom",
				path: ["endsAt"],
				message: "endsAt must be after startsAt",
			});
		}
	});

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

// GET /api/v1/maintenance/:maintenanceId - Get a maintenance window
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.maintenance.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		maintenanceWindowId: params.maintenanceId,
	});

	if (!hasScope(apiKey, "maintenance:read")) {
		logger().info("api.v1.maintenance.get.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
		});
		throw apiError("FORBIDDEN", "API key does not have maintenance:read scope", Forbidden);
	}

	let maintenanceWindow = await db().query.maintenanceWindows.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.maintenanceId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: {
			id: true,
			teamId: true,
			monitorId: true,
			name: true,
			startsAt: true,
			endsAt: true,
			endedEarlyAt: true,
			suppressAlerts: true,
			showOnStatusPage: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (!maintenanceWindow) {
		logger().info("api.v1.maintenance.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
		});
		throw apiError("NOT_FOUND", "Maintenance window not found", NotFound);
	}

	logger().info("api.v1.maintenance.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		maintenanceWindowId: maintenanceWindow.id,
	});

	return apiSuccess({ maintenanceWindow });
}

// PUT /api/v1/maintenance/:maintenanceId - Update a maintenance window
// DELETE /api/v1/maintenance/:maintenanceId - Delete a maintenance window
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.maintenance.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		maintenanceWindowId: params.maintenanceId,
		method: request.method,
	});

	if (!hasScope(apiKey, "maintenance:write")) {
		logger().info("api.v1.maintenance.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have maintenance:write scope", Forbidden);
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
		logger().info("api.v1.maintenance.action.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
			method: request.method,
		});
		throw apiError("NOT_FOUND", "Maintenance window not found", NotFound);
	}

	if (request.method === "DELETE") {
		await db()
			.delete(schema.maintenanceWindows)
			.where(eq(schema.maintenanceWindows.id, params.maintenanceId));

		logger().info("api.v1.maintenance.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: params.maintenanceId,
		});

		return apiSuccess({ deleted: true });
	}

	if (request.method === "PUT") {
		let result = await validate(request, updateMaintenanceSchema);
		if (isFailure(result)) {
			logger().info("api.v1.maintenance.update.validation-failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				maintenanceWindowId: params.maintenanceId,
				issues: result.error.issues,
			});
			throw apiError(
				"VALIDATION_ERROR",
				result.error.issues.map((issue) => issue.message).join(", "),
				BadRequest,
			);
		}

		if (result.data.monitorId !== undefined && result.data.monitorId !== null) {
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
				logger().info("api.v1.maintenance.update.monitor-not-found", {
					teamId: team.id,
					apiKeyId: apiKey.id,
					maintenanceWindowId: params.maintenanceId,
					monitorId: result.data.monitorId,
				});
				throw apiError("NOT_FOUND", "Monitor not found", NotFound);
			}
		}

		let newStartsAt = result.data.startsAt ?? existingMaintenanceWindow.startsAt;
		let newEndsAt = result.data.endsAt ?? existingMaintenanceWindow.endsAt;

		if (newEndsAt <= newStartsAt) {
			logger().info("api.v1.maintenance.update.invalid-dates", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				maintenanceWindowId: params.maintenanceId,
				startsAt: newStartsAt,
				endsAt: newEndsAt,
			});
			throw apiError("VALIDATION_ERROR", "endsAt must be after startsAt", BadRequest);
		}

		let updateData: Partial<schema.InsertMaintenanceWindow> = {};
		if (result.data.name !== undefined) updateData.name = result.data.name;
		if (result.data.monitorId !== undefined) updateData.monitorId = result.data.monitorId ?? null;
		if (result.data.startsAt !== undefined) updateData.startsAt = result.data.startsAt;
		if (result.data.endsAt !== undefined) updateData.endsAt = result.data.endsAt;
		if (result.data.suppressAlerts !== undefined)
			updateData.suppressAlerts = result.data.suppressAlerts;
		if (result.data.showOnStatusPage !== undefined)
			updateData.showOnStatusPage = result.data.showOnStatusPage;

		let [maintenanceWindow] = await db()
			.update(schema.maintenanceWindows)
			.set(updateData)
			.where(eq(schema.maintenanceWindows.id, params.maintenanceId))
			.returning();

		if (!maintenanceWindow) {
			logger().error("api.v1.maintenance.update.failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				maintenanceWindowId: params.maintenanceId,
			});
			throw apiError("INTERNAL_ERROR", "Failed to update maintenance window", InternalServerError);
		}

		logger().info("api.v1.maintenance.update.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			maintenanceWindowId: maintenanceWindow.id,
		});

		return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(maintenanceWindow) });
	}

	logger().info("api.v1.maintenance.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		maintenanceWindowId: params.maintenanceId,
		method: request.method,
	});
	throw apiError(
		"METHOD_NOT_ALLOWED",
		"Only GET, PUT, and DELETE methods are allowed",
		MethodNotAllowed,
	);
}
