/**
 * API v1 endpoint that replaces a status page's monitor and cron job associations: an
 * API-key middleware authenticates the request and the PUT action (status-pages:write)
 * validates the given ids, verifies they belong to the team, then clears and re-inserts
 * the ordered associations. It exists to let API clients set which checks a status page
 * displays.
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
	MethodNotAllowed,
	NotFound,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.status-pages.$statusPageId.monitors";

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

const statusPageColumns = {
	id: true,
	name: true,
	slug: true,
	title: true,
	description: true,
	logoUrl: true,
	customDomain: true,
	isPublic: true,
	showOverallStatus: true,
	createdAt: true,
	updatedAt: true,
} as const;

const updateAssociationsSchema = z.object({
	monitorIds: z.array(z.string().uuid()).optional().default([]),
	cronJobIds: z.array(z.string().uuid()).optional().default([]),
});

// PUT /api/v1/status-pages/:statusPageId/monitors - Update monitor and cron job associations
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.status-pages.monitors.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		statusPageId: params.statusPageId,
		method: request.method,
	});

	if (request.method !== "PUT") {
		logger().info("api.v1.status-pages.monitors.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only PUT method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "status-pages:write")) {
		logger().info("api.v1.status-pages.monitors.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
		});
		throw apiError("FORBIDDEN", "API key does not have status-pages:write scope", Forbidden);
	}

	let statusPage = await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.statusPageId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: statusPageColumns,
	});

	if (!statusPage) {
		logger().info("api.v1.status-pages.monitors.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
		});
		throw apiError("NOT_FOUND", "Status page not found", NotFound);
	}

	let result = await validate(request, updateAssociationsSchema);
	if (isFailure(result)) {
		logger().info("api.v1.status-pages.monitors.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
			issues: result.error.issues,
		});
		throw apiError(
			"VALIDATION_ERROR",
			result.error.issues.map((issue) => issue.message).join(", "),
			BadRequest,
		);
	}

	let monitorIds = result.data.monitorIds ?? [];
	let cronJobIds = result.data.cronJobIds ?? [];

	if (monitorIds.length > 0) {
		let monitors = await db().query.monitors.findMany({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.teamId, team.id),
					operators.inArray(fields.id, monitorIds),
				);
			},
			columns: { id: true },
		});

		if (monitors.length !== monitorIds.length) {
			logger().info("api.v1.status-pages.monitors.monitors-not-found", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				statusPageId: params.statusPageId,
				requested: monitorIds.length,
				found: monitors.length,
			});
			throw apiError("NOT_FOUND", "One or more monitors not found", NotFound);
		}
	}

	if (cronJobIds.length > 0) {
		let cronJobs = await db().query.cronJobMonitors.findMany({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.teamId, team.id),
					operators.inArray(fields.id, cronJobIds),
				);
			},
			columns: { id: true },
		});

		if (cronJobs.length !== cronJobIds.length) {
			logger().info("api.v1.status-pages.monitors.cron-jobs-not-found", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				statusPageId: params.statusPageId,
				requested: cronJobIds.length,
				found: cronJobs.length,
			});
			throw apiError("NOT_FOUND", "One or more cron jobs not found", NotFound);
		}
	}

	await db()
		.delete(schema.statusPageMonitors)
		.where(eq(schema.statusPageMonitors.statusPageId, params.statusPageId));

	await db()
		.delete(schema.statusPageCronJobs)
		.where(eq(schema.statusPageCronJobs.statusPageId, params.statusPageId));

	if (monitorIds.length > 0) {
		await db()
			.insert(schema.statusPageMonitors)
			.values(
				monitorIds.map((monitorId, index) => ({
					statusPageId: params.statusPageId,
					monitorId,
					order: index,
				})),
			);
	}

	if (cronJobIds.length > 0) {
		await db()
			.insert(schema.statusPageCronJobs)
			.values(
				cronJobIds.map((cronJobMonitorId, index) => ({
					statusPageId: params.statusPageId,
					cronJobMonitorId,
					order: index,
				})),
			);
	}

	logger().info("api.v1.status-pages.monitors.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		statusPageId: params.statusPageId,
		monitors: monitorIds.length,
		cronJobs: cronJobIds.length,
	});

	return apiSuccess({ statusPage, monitors: monitorIds, cronJobs: cronJobIds });
}
