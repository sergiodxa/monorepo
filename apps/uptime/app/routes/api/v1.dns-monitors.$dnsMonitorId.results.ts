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

import type { Route } from "./+types/v1.dns-monitors.$dnsMonitorId.results";

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

// GET /api/v1/dns-monitors/:dnsMonitorId/results - Get DNS monitor results/history
export async function loader({ request, params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.dns-monitors.results.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		dnsMonitorId: params.dnsMonitorId,
	});

	if (!hasScope(apiKey, "dns-monitors:read")) {
		logger().info("api.v1.dns-monitors.results.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			dnsMonitorId: params.dnsMonitorId,
		});
		throw apiError("FORBIDDEN", "API key does not have dns-monitors:read scope", Forbidden);
	}

	let dnsMonitor = await db().query.dnsMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.dnsMonitorId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: { id: true },
	});

	if (!dnsMonitor) {
		logger().info("api.v1.dns-monitors.results.list.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			dnsMonitorId: params.dnsMonitorId,
		});
		throw apiError("NOT_FOUND", "DNS monitor not found", NotFound);
	}

	let url = new URL(request.url);
	let limitParam = url.searchParams.get("limit");
	let limitSchema = z.coerce.number().int().min(1).max(200).default(50);
	let limit = limitSchema.parse(limitParam ?? 50);

	let results = await db().query.dnsMonitorResults.findMany({
		where(fields, operators) {
			return operators.eq(fields.dnsMonitorId, params.dnsMonitorId);
		},
		columns: {
			id: true,
			status: true,
			resolvedValue: true,
			responseTimeMs: true,
			errorMessage: true,
			checkedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.checkedAt);
		},
		limit,
	});

	logger().info("api.v1.dns-monitors.results.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		dnsMonitorId: params.dnsMonitorId,
		count: results.length,
		limit,
	});

	return apiSuccess({ results });
}
