import { z } from "zod/v4";

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

import type { Route } from "./+types/monitors.$monitorId.results";

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

// GET /api/v1/monitors/:monitorId/results - Get monitor results/history
export async function loader({ request, params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	if (!hasScope(apiKey, "monitors:read")) {
		throw apiError("FORBIDDEN", "API key does not have monitors:read scope", 403);
	}

	// Verify the monitor belongs to this team
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
		throw apiError("NOT_FOUND", "Monitor not found", 404);
	}

	// Parse query parameters for pagination
	let url = new URL(request.url);
	let limitParam = url.searchParams.get("limit");
	let offsetParam = url.searchParams.get("offset");

	let limitSchema = z.coerce.number().int().min(1).max(100).default(50);
	let offsetSchema = z.coerce.number().int().min(0).default(0);

	let limit = limitSchema.parse(limitParam ?? 50);
	let offset = offsetSchema.parse(offsetParam ?? 0);

	let results = await db().query.monitorResults.findMany({
		where(fields, operators) {
			return operators.eq(fields.monitorId, params.monitorId);
		},
		columns: {
			id: true,
			responseStatus: true,
			responseTimeMs: true,
			completedAt: true,
			createdAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
		limit: limit + 1, // Fetch one extra to check if there are more
		offset,
	});

	let hasMore = results.length > limit;
	if (hasMore) {
		results = results.slice(0, limit);
	}

	logger().info("api.v1.monitors.results.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		count: results.length,
		limit,
		offset,
	});

	return apiSuccess({
		results,
		pagination: {
			limit,
			offset,
			hasMore,
		},
	});
}
