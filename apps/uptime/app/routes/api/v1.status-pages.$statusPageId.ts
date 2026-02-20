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

import type { Route } from "./+types/v1.status-pages.$statusPageId";

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

async function fetchStatusPageWithRelations(teamId: string, statusPageId: string) {
	return await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, statusPageId),
				operators.eq(fields.teamId, teamId),
			);
		},
		columns: statusPageColumns,
		with: {
			monitors: {
				columns: { monitorId: true },
			},
			cronJobs: {
				columns: { cronJobMonitorId: true },
			},
		},
	});
}

// GET /api/v1/status-pages/:statusPageId - Get a status page
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.status-pages.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		statusPageId: params.statusPageId,
	});

	if (!hasScope(apiKey, "status-pages:read")) {
		logger().info("api.v1.status-pages.get.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
		});
		throw apiError("FORBIDDEN", "API key does not have status-pages:read scope", Forbidden);
	}

	let statusPage = await fetchStatusPageWithRelations(team.id, params.statusPageId);

	if (!statusPage) {
		logger().info("api.v1.status-pages.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
		});
		throw apiError("NOT_FOUND", "Status page not found", NotFound);
	}

	let monitorIds = statusPage.monitors.map((monitor) => monitor.monitorId);
	let cronJobIds = statusPage.cronJobs.map((cronJob) => cronJob.cronJobMonitorId);

	logger().info("api.v1.status-pages.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		statusPageId: statusPage.id,
		monitors: monitorIds.length,
		cronJobs: cronJobIds.length,
	});

	return apiSuccess({
		statusPage: {
			...statusPage,
			monitors: monitorIds,
			cronJobs: cronJobIds,
		},
	});
}

const updateStatusPageSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
		.optional(),
	title: z.string().min(1).max(255).optional(),
	description: z.string().max(500).optional(),
	logoUrl: z.string().url().optional(),
	customDomain: z.string().min(1).optional(),
	isPublic: z.boolean().optional(),
	showOverallStatus: z.boolean().optional(),
});

// PUT /api/v1/status-pages/:statusPageId - Update a status page
// DELETE /api/v1/status-pages/:statusPageId - Delete a status page
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.status-pages.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		statusPageId: params.statusPageId,
		method: request.method,
	});

	if (!hasScope(apiKey, "status-pages:write")) {
		logger().info("api.v1.status-pages.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have status-pages:write scope", Forbidden);
	}

	let existingStatusPage = await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.statusPageId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: statusPageColumns,
	});

	if (!existingStatusPage) {
		logger().info("api.v1.status-pages.action.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
			method: request.method,
		});
		throw apiError("NOT_FOUND", "Status page not found", NotFound);
	}

	if (request.method === "DELETE") {
		await db()
			.delete(schema.statusPageMonitors)
			.where(eq(schema.statusPageMonitors.statusPageId, params.statusPageId));

		await db()
			.delete(schema.statusPageCronJobs)
			.where(eq(schema.statusPageCronJobs.statusPageId, params.statusPageId));

		await db().delete(schema.statusPages).where(eq(schema.statusPages.id, params.statusPageId));

		logger().info("api.v1.status-pages.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: params.statusPageId,
		});

		return apiSuccess({ deleted: true });
	}

	if (request.method === "PUT") {
		let result = await validate(request, updateStatusPageSchema);
		if (isFailure(result)) {
			logger().info("api.v1.status-pages.update.validation-failed", {
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

		let updateData: Partial<schema.InsertStatusPage> = {};
		if (result.data.name !== undefined) updateData.name = result.data.name;
		if (result.data.slug !== undefined) updateData.slug = result.data.slug;
		if (result.data.title !== undefined) updateData.title = result.data.title;
		if (result.data.description !== undefined)
			updateData.description = result.data.description ?? null;
		if (result.data.logoUrl !== undefined) updateData.logoUrl = result.data.logoUrl ?? null;
		if (result.data.customDomain !== undefined)
			updateData.customDomain = result.data.customDomain ?? null;
		if (result.data.isPublic !== undefined) updateData.isPublic = result.data.isPublic;
		if (result.data.showOverallStatus !== undefined)
			updateData.showOverallStatus = result.data.showOverallStatus;

		if (Object.keys(updateData).length > 0) {
			let [updated] = await db()
				.update(schema.statusPages)
				.set(updateData)
				.where(eq(schema.statusPages.id, params.statusPageId))
				.returning({ id: schema.statusPages.id });

			if (!updated) {
				logger().error("api.v1.status-pages.update.failed", {
					teamId: team.id,
					apiKeyId: apiKey.id,
					statusPageId: params.statusPageId,
				});
				throw apiError("INTERNAL_ERROR", "Failed to update status page", InternalServerError);
			}
		}

		let statusPageWithRelations = await fetchStatusPageWithRelations(team.id, params.statusPageId);

		if (!statusPageWithRelations) {
			logger().error("api.v1.status-pages.update.post-fetch-missing", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				statusPageId: params.statusPageId,
			});
			throw apiError("INTERNAL_ERROR", "Failed to load updated status page", InternalServerError);
		}

		let monitorIds = statusPageWithRelations.monitors.map((monitor) => monitor.monitorId);
		let cronJobIds = statusPageWithRelations.cronJobs.map((cronJob) => cronJob.cronJobMonitorId);

		logger().info("api.v1.status-pages.update.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			statusPageId: statusPageWithRelations.id,
			monitors: monitorIds.length,
			cronJobs: cronJobIds.length,
		});

		return apiSuccess({
			statusPage: {
				...statusPageWithRelations,
				monitors: monitorIds,
				cronJobs: cronJobIds,
			},
		});
	}

	logger().info("api.v1.status-pages.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		statusPageId: params.statusPageId,
		method: request.method,
	});
	throw apiError(
		"METHOD_NOT_ALLOWED",
		"Only GET, PUT, and DELETE methods are allowed",
		MethodNotAllowed,
	);
}
