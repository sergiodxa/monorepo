import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { z } from "zod/v4";

import type { ApiKeyScope } from "~/db/schema";

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

import type { Route } from "./+types/v1.tcp-monitors";

const TCP_MONITORS_READ_SCOPE = "tcp-monitors:read" as ApiKeyScope;
const TCP_MONITORS_WRITE_SCOPE = "tcp-monitors:write" as ApiKeyScope;

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

// GET /api/v1/tcp-monitors - List all TCP monitors
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.tcp-monitors.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, TCP_MONITORS_READ_SCOPE)) {
		logger().info("api.v1.tcp-monitors.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have tcp-monitors:read scope", 403);
	}

	let monitors = await db().query.tcpMonitors.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			host: true,
			port: true,
			timeoutMs: true,
			intervalSeconds: true,
			isEnabled: true,
			lastCheckedAt: true,
			lastStatus: true,
			lastResponseTimeMs: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.tcp-monitors.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: monitors.length,
	});

	return apiSuccess({ monitors });
}

const createTcpMonitorSchema = z.object({
	name: z.string().min(1).max(255),
	host: z.string().min(1).max(255),
	port: z.number().int().min(1).max(65535),
	timeoutMs: z.number().int().min(100).max(60000).default(5000),
	intervalSeconds: z.number().int().min(10).max(86400).default(60),
	isEnabled: z.boolean().default(true),
});

// POST /api/v1/tcp-monitors - Create a new TCP monitor
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.tcp-monitors.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.tcp-monitors.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
	}

	if (!hasScope(apiKey, TCP_MONITORS_WRITE_SCOPE)) {
		logger().info("api.v1.tcp-monitors.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have tcp-monitors:write scope", 403);
	}

	let result = await validate(request, createTcpMonitorSchema);
	if (isFailure(result)) {
		logger().info("api.v1.tcp-monitors.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			issues: result.error.issues,
		});
		throw apiError("VALIDATION_ERROR", result.error.issues.map((i) => i.message).join(", "), 400);
	}

	let [monitor] = await db()
		.insert(schema.tcpMonitors)
		.values({
			teamId: team.id,
			name: result.data.name,
			host: result.data.host,
			port: result.data.port,
			timeoutMs: result.data.timeoutMs,
			intervalSeconds: result.data.intervalSeconds,
			isEnabled: result.data.isEnabled,
		})
		.returning();

	if (!monitor) {
		logger().error("api.v1.tcp-monitors.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create TCP monitor", 500);
	}

	logger().info("api.v1.tcp-monitors.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: monitor.id,
	});

	return apiSuccess({ monitor }, 201);
}
