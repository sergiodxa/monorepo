import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { z } from "zod/v4";

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

import type { Route } from "./+types/monitors";

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

// GET /api/v1/monitors - List all monitors
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "monitors:read")) {
		logger().info("api.v1.monitors.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:read scope", 403);
	}

	let monitors = await db().query.monitors.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			url: true,
			method: true,
			expectedStatus: true,
			intervalSeconds: true,
			degradedAfterMs: true,
			timeoutSeconds: true,
			locationHint: true,
			enabledAt: true,
			sslMonitoringEnabled: true,
			sslExpiryWarningDays: true,
			sslExpiresAt: true,
			sslIssuer: true,
			sslStatus: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.monitors.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: monitors.length,
	});

	return apiSuccess({ monitors });
}

const createMonitorSchema = z.object({
	name: z.string().min(1).max(255),
	url: z.url(),
	method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("HEAD"),
	expectedStatus: z.number().int().min(100).max(599).default(200),
	intervalSeconds: z.number().int().min(60).max(3600).default(60),
	degradedAfterMs: z.number().int().min(1000).max(30000).default(5000),
	timeoutSeconds: z.number().int().min(1).max(60).default(10),
	locationHint: z
		.enum(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"])
		.default("wnam"),
	sslMonitoringEnabled: z.boolean().default(false),
	sslExpiryWarningDays: z.number().int().min(1).max(365).default(30),
});

// POST /api/v1/monitors - Create a new monitor
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.monitors.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
	}

	if (!hasScope(apiKey, "monitors:write")) {
		logger().info("api.v1.monitors.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:write scope", 403);
	}

	let result = await validate(request, createMonitorSchema);
	if (isFailure(result)) {
		logger().info("api.v1.monitors.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			issues: result.error.issues,
		});
		throw apiError("VALIDATION_ERROR", result.error.issues.map((i) => i.message).join(", "), 400);
	}

	let [monitor] = await db()
		.insert(schema.monitors)
		.values({
			teamId: team.id,
			authorId: team.ownerId, // Use team owner as author for API-created monitors
			name: result.data.name,
			url: result.data.url,
			method: result.data.method,
			expectedStatus: result.data.expectedStatus,
			intervalSeconds: result.data.intervalSeconds,
			degradedAfterMs: result.data.degradedAfterMs,
			timeoutSeconds: result.data.timeoutSeconds,
			locationHint: result.data.locationHint,
			sslMonitoringEnabled: result.data.sslMonitoringEnabled,
			sslExpiryWarningDays: result.data.sslExpiryWarningDays,
		})
		.returning();

	if (!monitor) {
		logger().error("api.v1.monitors.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create monitor", 500);
	}

	logger().info("api.v1.monitors.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: monitor.id,
	});

	return apiSuccess({ monitor }, 201);
}
