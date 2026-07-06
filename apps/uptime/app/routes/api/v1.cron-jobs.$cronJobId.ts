/**
 * API route for reading, updating, and deleting a single cron-job monitor. The
 * loader returns the job (cron-jobs:read scope); the action handles PUT and DELETE
 * (cron-jobs:write scope), re-parsing the cron expression and timezone to recompute
 * the next expected run. It lets teams manage scheduled-job monitors via the API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

import type { Route } from "./+types/v1.cron-jobs.$cronJobId";

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

// GET /api/v1/cron-jobs/:cronJobId - Get a specific cron job
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.cron-jobs.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: params.cronJobId,
	});

	if (!hasScope(apiKey, "cron-jobs:read")) {
		logger().info("api.v1.cron-jobs.get.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
		});
		throw apiError("FORBIDDEN", "API key does not have cron-jobs:read scope", Forbidden);
	}

	let cronJob = await db().query.cronJobMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.cronJobId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: {
			id: true,
			name: true,
			description: true,
			cronExpression: true,
			gracePeriodSeconds: true,
			timezone: true,
			status: true,
			alertOnLate: true,
			lastPingAt: true,
			nextExpectedAt: true,
			enabledAt: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (!cronJob) {
		logger().info("api.v1.cron-jobs.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
		});
		throw apiError("NOT_FOUND", "Cron job not found", NotFound);
	}

	logger().info("api.v1.cron-jobs.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: cronJob.id,
	});

	return apiSuccess({ cronJob });
}

const updateCronJobSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	cronExpression: z.string().min(1).optional(),
	gracePeriodSeconds: z.number().int().min(60).max(86400).optional(),
	timezone: z.string().optional(),
	alertOnLate: z.boolean().optional(),
	enabled: z.boolean().optional(),
});

// PUT /api/v1/cron-jobs/:cronJobId - Update a cron job
// DELETE /api/v1/cron-jobs/:cronJobId - Delete a cron job
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.cron-jobs.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: params.cronJobId,
		method: request.method,
	});

	if (!hasScope(apiKey, "cron-jobs:write")) {
		logger().info("api.v1.cron-jobs.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have cron-jobs:write scope", Forbidden);
	}

	// First verify the cron job belongs to this team
	let existingCronJob = await db().query.cronJobMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.cronJobId),
				operators.eq(fields.teamId, team.id),
			);
		},
	});

	if (!existingCronJob) {
		logger().info("api.v1.cron-jobs.action.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
			method: request.method,
		});
		throw apiError("NOT_FOUND", "Cron job not found", NotFound);
	}

	if (request.method === "DELETE") {
		await db()
			.delete(schema.cronJobMonitors)
			.where(eq(schema.cronJobMonitors.id, params.cronJobId));

		logger().info("api.v1.cron-jobs.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
		});

		return apiSuccess({ deleted: true });
	}

	if (request.method === "PUT") {
		let result = await validate(request, updateCronJobSchema);
		if (isFailure(result)) {
			logger().info("api.v1.cron-jobs.update.validation-failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				cronJobId: params.cronJobId,
				issues: result.error.issues,
			});
			throw apiError(
				"VALIDATION_ERROR",
				result.error.issues.map((i) => i.message).join(", "),
				BadRequest,
			);
		}

		let updateData: Partial<schema.InsertCronJobMonitor> = {};

		if (result.data.name !== undefined) updateData.name = result.data.name;
		if (result.data.description !== undefined) updateData.description = result.data.description;
		if (result.data.gracePeriodSeconds !== undefined)
			updateData.gracePeriodSeconds = result.data.gracePeriodSeconds;
		if (result.data.timezone !== undefined) updateData.timezone = result.data.timezone;
		if (result.data.alertOnLate !== undefined) updateData.alertOnLate = result.data.alertOnLate;
		if (result.data.enabled !== undefined) {
			updateData.enabledAt = result.data.enabled ? new Date() : null;
		}

		// Handle cron expression update - validate and calculate next expected
		if (result.data.cronExpression !== undefined) {
			let CronExpressionParser = await import("cron-parser").then((m) => m.default);
			let timezone = result.data.timezone ?? existingCronJob.timezone;
			try {
				let interval = CronExpressionParser.parse(result.data.cronExpression, {
					tz: timezone,
				});
				updateData.cronExpression = result.data.cronExpression;
				updateData.nextExpectedAt = interval.next().toDate();
			} catch {
				logger().info("api.v1.cron-jobs.update.invalid-cron-expression", {
					teamId: team.id,
					apiKeyId: apiKey.id,
					cronJobId: params.cronJobId,
					cronExpression: result.data.cronExpression,
				});
				throw apiError("VALIDATION_ERROR", "Invalid cron expression", BadRequest);
			}
		} else if (
			result.data.timezone !== undefined &&
			result.data.timezone !== existingCronJob.timezone
		) {
			// Timezone changed without cron expression change - recalculate next expected
			let CronExpressionParser = await import("cron-parser").then((m) => m.default);
			try {
				let interval = CronExpressionParser.parse(existingCronJob.cronExpression, {
					tz: result.data.timezone,
				});
				updateData.nextExpectedAt = interval.next().toDate();
			} catch {
				// Should not happen with existing valid cron expression
			}
		}

		let [cronJob] = await db()
			.update(schema.cronJobMonitors)
			.set(updateData)
			.where(eq(schema.cronJobMonitors.id, params.cronJobId))
			.returning();

		if (!cronJob) {
			logger().error("api.v1.cron-jobs.update.failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				cronJobId: params.cronJobId,
			});
			throw apiError("INTERNAL_ERROR", "Failed to update cron job", InternalServerError);
		}

		logger().info("api.v1.cron-jobs.update.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: cronJob.id,
		});

		return apiSuccess({ cronJob });
	}

	logger().info("api.v1.cron-jobs.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: params.cronJobId,
		method: request.method,
	});
	throw apiError(
		"METHOD_NOT_ALLOWED",
		"Only GET, PUT, and DELETE methods are allowed",
		MethodNotAllowed,
	);
}
