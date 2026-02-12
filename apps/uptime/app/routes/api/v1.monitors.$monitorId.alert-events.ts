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

import type { Route } from "./+types/v1.monitors.$monitorId.alert-events";

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

// GET /api/v1/monitors/:monitorId/alert-events - List alert events for a monitor
export async function loader({ request, params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.alert-events.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
	});

	if (!hasScope(apiKey, "alerts:read")) {
		logger().info("api.v1.monitors.alert-events.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("FORBIDDEN", "API key does not have alerts:read scope", 403);
	}

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
		logger().info("api.v1.monitors.alert-events.list.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("NOT_FOUND", "Monitor not found", 404);
	}

	let url = new URL(request.url);
	let limitParam = url.searchParams.get("limit");
	let limitSchema = z.coerce.number().int().min(1).max(200).default(50);
	let limit = limitSchema.parse(limitParam ?? 50);

	let events = await db().query.alertEvents.findMany({
		where(fields, operators) {
			return operators.eq(fields.monitorId, params.monitorId);
		},
		columns: {
			id: true,
			alertId: true,
			monitorId: true,
			eventType: true,
			status: true,
			sentAt: true,
			errorMessage: true,
			createdAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.sentAt);
		},
		limit,
	});

	logger().info("api.v1.monitors.alert-events.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		count: events.length,
		limit,
	});

	return apiSuccess({ events });
}
