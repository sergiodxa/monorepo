/**
 * API v1 endpoint that lists the delivery events for a single alert: an API-key
 * middleware authenticates the request and the loader (alerts:read) confirms the alert
 * belongs to the team, then returns its events ordered newest-first up to a bounded
 * limit. It exists to expose an alert's notification history over the public API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod/v4";

import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	Forbidden,
	hasScope,
	NotFound,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.alerts.$alertId.events";

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

// GET /api/v1/alerts/:alertId/events - List events for an alert
export async function loader({ request, params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.alerts.events.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		alertId: params.alertId,
	});

	if (!hasScope(apiKey, "alerts:read")) {
		logger().info("api.v1.alerts.events.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: params.alertId,
		});
		throw apiError("FORBIDDEN", "API key does not have alerts:read scope", Forbidden);
	}

	let alert = await db().query.alerts.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.alertId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: { id: true },
	});

	if (!alert) {
		logger().info("api.v1.alerts.events.list.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			alertId: params.alertId,
		});
		throw apiError("NOT_FOUND", "Alert not found", NotFound);
	}

	let url = new URL(request.url);
	let limitParam = url.searchParams.get("limit");
	let limitSchema = z.coerce.number().int().min(1).max(200).default(50);
	let limit = limitSchema.parse(limitParam ?? 50);

	let events = await db().query.alertEvents.findMany({
		where(fields, operators) {
			return operators.eq(fields.alertId, params.alertId);
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

	logger().info("api.v1.alerts.events.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		alertId: params.alertId,
		count: events.length,
		limit,
	});

	return apiSuccess({ events });
}
