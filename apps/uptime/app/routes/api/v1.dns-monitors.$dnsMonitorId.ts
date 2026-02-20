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

import type { Route } from "./+types/v1.dns-monitors.$dnsMonitorId";

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

// GET /api/v1/dns-monitors/:dnsMonitorId - Get a specific DNS monitor
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.dns-monitors.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		dnsMonitorId: params.dnsMonitorId,
	});

	if (!hasScope(apiKey, "dns-monitors:read")) {
		logger().info("api.v1.dns-monitors.get.forbidden", {
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
		columns: {
			id: true,
			name: true,
			domain: true,
			recordType: true,
			expectedValue: true,
			intervalSeconds: true,
			isEnabled: true,
			lastCheckedAt: true,
			lastStatus: true,
			lastValue: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (!dnsMonitor) {
		logger().info("api.v1.dns-monitors.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			dnsMonitorId: params.dnsMonitorId,
		});
		throw apiError("NOT_FOUND", "DNS monitor not found", NotFound);
	}

	logger().info("api.v1.dns-monitors.get", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		dnsMonitorId: dnsMonitor.id,
	});

	return apiSuccess({ dnsMonitor });
}

const updateDnsMonitorSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	domain: z.string().min(1).max(255).optional(),
	recordType: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]).optional(),
	expectedValue: z.string().max(1024).nullable().optional(),
	intervalSeconds: z.number().int().min(60).max(86400).optional(),
	isEnabled: z.boolean().optional(),
});

// PUT /api/v1/dns-monitors/:dnsMonitorId - Update a DNS monitor
// DELETE /api/v1/dns-monitors/:dnsMonitorId - Delete a DNS monitor
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.dns-monitors.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		dnsMonitorId: params.dnsMonitorId,
		method: request.method,
	});

	if (!hasScope(apiKey, "dns-monitors:write")) {
		logger().info("api.v1.dns-monitors.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			dnsMonitorId: params.dnsMonitorId,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have dns-monitors:write scope", Forbidden);
	}

	let existingMonitor = await db().query.dnsMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.dnsMonitorId),
				operators.eq(fields.teamId, team.id),
			);
		},
	});

	if (!existingMonitor) {
		logger().info("api.v1.dns-monitors.action.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			dnsMonitorId: params.dnsMonitorId,
			method: request.method,
		});
		throw apiError("NOT_FOUND", "DNS monitor not found", NotFound);
	}

	if (request.method === "DELETE") {
		await db().delete(schema.dnsMonitors).where(eq(schema.dnsMonitors.id, params.dnsMonitorId));

		logger().info("api.v1.dns-monitors.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			dnsMonitorId: params.dnsMonitorId,
		});

		return apiSuccess({ deleted: true });
	}

	if (request.method === "PUT") {
		let result = await validate(request, updateDnsMonitorSchema);
		if (isFailure(result)) {
			logger().info("api.v1.dns-monitors.update.validation-failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				dnsMonitorId: params.dnsMonitorId,
				issues: result.error.issues,
			});
			throw apiError(
				"VALIDATION_ERROR",
				result.error.issues.map((i) => i.message).join(", "),
				BadRequest,
			);
		}

		let updateData: Partial<schema.InsertDnsMonitor> = {};
		if (result.data.name !== undefined) updateData.name = result.data.name;
		if (result.data.domain !== undefined) updateData.domain = result.data.domain;
		if (result.data.recordType !== undefined) updateData.recordType = result.data.recordType;
		if (result.data.expectedValue !== undefined)
			updateData.expectedValue = result.data.expectedValue;
		if (result.data.intervalSeconds !== undefined)
			updateData.intervalSeconds = result.data.intervalSeconds;
		if (result.data.isEnabled !== undefined) updateData.isEnabled = result.data.isEnabled;

		let [dnsMonitor] = await db()
			.update(schema.dnsMonitors)
			.set(updateData)
			.where(eq(schema.dnsMonitors.id, params.dnsMonitorId))
			.returning();

		if (!dnsMonitor) {
			logger().error("api.v1.dns-monitors.update.failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				dnsMonitorId: params.dnsMonitorId,
			});
			throw apiError("INTERNAL_ERROR", "Failed to update DNS monitor", InternalServerError);
		}

		logger().info("api.v1.dns-monitors.update.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			dnsMonitorId: dnsMonitor.id,
		});

		return apiSuccess({ dnsMonitor });
	}

	logger().info("api.v1.dns-monitors.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		dnsMonitorId: params.dnsMonitorId,
		method: request.method,
	});
	throw apiError("METHOD_NOT_ALLOWED", "Only PUT and DELETE methods are allowed", MethodNotAllowed);
}
