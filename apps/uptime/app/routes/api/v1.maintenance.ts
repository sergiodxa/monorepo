import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { z } from "zod/v4";

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

import type { Route } from "./+types/v1.maintenance";

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

const isoDateString = z.string().datetime();

const createMaintenanceSchema = z
	.object({
		name: z.string().min(1).max(255),
		monitorId: z.string().uuid().optional().nullable(),
		startsAt: isoDateString.transform((value) => new Date(value)),
		endsAt: isoDateString.transform((value) => new Date(value)),
		suppressAlerts: z.boolean().default(true),
		showOnStatusPage: z.boolean().default(true),
	})
	.superRefine((data, ctx) => {
		if (data.endsAt <= data.startsAt) {
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

// GET /api/v1/maintenance - List all maintenance windows
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.maintenance.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "maintenance:read")) {
		logger().info("api.v1.maintenance.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have maintenance:read scope", 403);
	}

	let maintenanceWindows = await db().query.maintenanceWindows.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
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
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.maintenance.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: maintenanceWindows.length,
	});

	return apiSuccess({ maintenanceWindows });
}

// POST /api/v1/maintenance - Create a maintenance window
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.maintenance.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.maintenance.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
	}

	if (!hasScope(apiKey, "maintenance:write")) {
		logger().info("api.v1.maintenance.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have maintenance:write scope", 403);
	}

	let result = await validate(request, createMaintenanceSchema);
	if (isFailure(result)) {
		logger().info("api.v1.maintenance.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			issues: result.error.issues,
		});
		throw apiError(
			"VALIDATION_ERROR",
			result.error.issues.map((issue) => issue.message).join(", "),
			400,
		);
	}

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
			logger().info("api.v1.maintenance.create.monitor-not-found", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				monitorId: result.data.monitorId,
			});
			throw apiError("NOT_FOUND", "Monitor not found", 404);
		}
	}

	let [maintenanceWindow] = await db()
		.insert(schema.maintenanceWindows)
		.values({
			teamId: team.id,
			monitorId: result.data.monitorId ?? null,
			name: result.data.name,
			startsAt: result.data.startsAt,
			endsAt: result.data.endsAt,
			suppressAlerts: result.data.suppressAlerts,
			showOnStatusPage: result.data.showOnStatusPage,
		})
		.returning();

	if (!maintenanceWindow) {
		logger().error("api.v1.maintenance.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create maintenance window", 500);
	}

	logger().info("api.v1.maintenance.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		maintenanceWindowId: maintenanceWindow.id,
	});

	return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(maintenanceWindow) }, 201);
}
