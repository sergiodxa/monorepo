/**
 * API route for reading, updating, and deleting a single TCP monitor. The loader
 * returns the monitor's config and last-check state (tcp-monitors:read scope); the
 * action handles PUT and DELETE (tcp-monitors:write scope) after confirming team
 * ownership. It lets teams manage host/port connectivity monitors via the API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import type { ApiKeyScope } from "~/db/schema";

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

import type { Route } from "./+types/v1.tcp-monitors.$tcpMonitorId";

const TCP_MONITORS_READ_SCOPE = "tcp-monitors:read" as ApiKeyScope;
const TCP_MONITORS_WRITE_SCOPE = "tcp-monitors:write" as ApiKeyScope;

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

// GET /api/v1/tcp-monitors/:tcpMonitorId - Get a specific TCP monitor
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.tcp-monitors.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		tcpMonitorId: params.tcpMonitorId,
	});

	if (!hasScope(apiKey, TCP_MONITORS_READ_SCOPE)) {
		logger().info("api.v1.tcp-monitors.get.forbidden", {
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
	});

	if (!monitor) {
		logger().info("api.v1.tcp-monitors.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			tcpMonitorId: params.tcpMonitorId,
		});
		throw apiError("NOT_FOUND", "TCP monitor not found", NotFound);
	}

	logger().info("api.v1.tcp-monitors.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		tcpMonitorId: monitor.id,
	});

	return apiSuccess({ monitor });
}

const updateTcpMonitorSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	host: z.string().min(1).max(255).optional(),
	port: z.number().int().min(1).max(65535).optional(),
	timeoutMs: z.number().int().min(100).max(60000).optional(),
	intervalSeconds: z.number().int().min(10).max(86400).optional(),
	isEnabled: z.boolean().optional(),
});

// PUT /api/v1/tcp-monitors/:tcpMonitorId - Update a TCP monitor
// DELETE /api/v1/tcp-monitors/:tcpMonitorId - Delete a TCP monitor
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.tcp-monitors.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		tcpMonitorId: params.tcpMonitorId,
		method: request.method,
	});

	if (!hasScope(apiKey, TCP_MONITORS_WRITE_SCOPE)) {
		logger().info("api.v1.tcp-monitors.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			tcpMonitorId: params.tcpMonitorId,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have tcp-monitors:write scope", Forbidden);
	}

	let existingMonitor = await db().query.tcpMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.tcpMonitorId),
				operators.eq(fields.teamId, team.id),
			);
		},
	});

	if (!existingMonitor) {
		logger().info("api.v1.tcp-monitors.action.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			tcpMonitorId: params.tcpMonitorId,
			method: request.method,
		});
		throw apiError("NOT_FOUND", "TCP monitor not found", NotFound);
	}

	if (request.method === "DELETE") {
		await db().delete(schema.tcpMonitors).where(eq(schema.tcpMonitors.id, params.tcpMonitorId));

		logger().info("api.v1.tcp-monitors.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			tcpMonitorId: params.tcpMonitorId,
		});

		return apiSuccess({ deleted: true });
	}

	if (request.method === "PUT") {
		let result = await validate(request, updateTcpMonitorSchema);
		if (isFailure(result)) {
			logger().info("api.v1.tcp-monitors.update.validation-failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				tcpMonitorId: params.tcpMonitorId,
				issues: result.error.issues,
			});
			throw apiError(
				"VALIDATION_ERROR",
				result.error.issues.map((i) => i.message).join(", "),
				BadRequest,
			);
		}

		let updateData: Partial<schema.InsertTcpMonitor> = {};
		if (result.data.name !== undefined) updateData.name = result.data.name;
		if (result.data.host !== undefined) updateData.host = result.data.host;
		if (result.data.port !== undefined) updateData.port = result.data.port;
		if (result.data.timeoutMs !== undefined) updateData.timeoutMs = result.data.timeoutMs;
		if (result.data.intervalSeconds !== undefined)
			updateData.intervalSeconds = result.data.intervalSeconds;
		if (result.data.isEnabled !== undefined) updateData.isEnabled = result.data.isEnabled;

		let [monitor] = await db()
			.update(schema.tcpMonitors)
			.set(updateData)
			.where(eq(schema.tcpMonitors.id, params.tcpMonitorId))
			.returning();

		if (!monitor) {
			logger().error("api.v1.tcp-monitors.update.failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				tcpMonitorId: params.tcpMonitorId,
			});
			throw apiError("INTERNAL_ERROR", "Failed to update TCP monitor", InternalServerError);
		}

		logger().info("api.v1.tcp-monitors.update.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			tcpMonitorId: monitor.id,
		});

		return apiSuccess({ monitor });
	}

	logger().info("api.v1.tcp-monitors.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		tcpMonitorId: params.tcpMonitorId,
		method: request.method,
	});
	throw apiError(
		"METHOD_NOT_ALLOWED",
		"Only GET, PUT, and DELETE methods are allowed",
		MethodNotAllowed,
	);
}
