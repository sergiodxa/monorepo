/**
 * API route serving the check-result history for a single TCP monitor. Its loader
 * authenticates by API key, requires the tcp-monitors:read scope, confirms team
 * ownership of the monitor, and returns paginated results (status, response time,
 * error) ordered by check time. It backs TCP monitor history and charts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod/v4";

import type { ApiKeyScope } from "~/db/schema";

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

import type { Route } from "./+types/v1.tcp-monitors.$tcpMonitorId.results";

const TCP_MONITORS_READ_SCOPE = "tcp-monitors:read" as ApiKeyScope;

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

// GET /api/v1/tcp-monitors/:tcpMonitorId/results - Get TCP monitor results/history
export async function loader({ request, params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.tcp-monitors.results.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		tcpMonitorId: params.tcpMonitorId,
	});

	if (!hasScope(apiKey, TCP_MONITORS_READ_SCOPE)) {
		logger().info("api.v1.tcp-monitors.results.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			tcpMonitorId: params.tcpMonitorId,
		});
		throw apiError("FORBIDDEN", "API key does not have tcp-monitors:read scope", Forbidden);
	}

	let monitor = await db().query.tcpMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.tcpMonitorId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: { id: true },
	});

	if (!monitor) {
		logger().info("api.v1.tcp-monitors.results.list.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			tcpMonitorId: params.tcpMonitorId,
		});
		throw apiError("NOT_FOUND", "TCP monitor not found", NotFound);
	}

	let url = new URL(request.url);
	let limitParam = url.searchParams.get("limit");
	let offsetParam = url.searchParams.get("offset");

	let limitSchema = z.coerce.number().int().min(1).max(200).default(50);
	let offsetSchema = z.coerce.number().int().min(0).default(0);

	let limit = limitSchema.parse(limitParam ?? 50);
	let offset = offsetSchema.parse(offsetParam ?? 0);

	let results = await db().query.tcpMonitorResults.findMany({
		where(fields, operators) {
			return operators.eq(fields.tcpMonitorId, params.tcpMonitorId);
		},
		columns: {
			id: true,
			status: true,
			responseTimeMs: true,
			errorMessage: true,
			checkedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.checkedAt);
		},
		limit: limit + 1,
		offset,
	});

	let hasMore = results.length > limit;
	if (hasMore) {
		results = results.slice(0, limit);
	}

	logger().info("api.v1.tcp-monitors.results.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		tcpMonitorId: params.tcpMonitorId,
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
