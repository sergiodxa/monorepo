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

import type { Route } from "./+types/v1.monitors.$monitorId.content-checks";

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

const createContentCheckSchema = z.object({
	type: z.enum(["contains", "not_contains", "regex"]),
	value: z.string().min(1),
	caseSensitive: z.boolean().default(false).optional(),
	isEnabled: z.boolean().default(true).optional(),
});

// GET /api/v1/monitors/:monitorId/content-checks - List content checks
export async function loader({ params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.content-checks.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
	});

	if (!hasScope(apiKey, "monitors:read")) {
		logger().info("api.v1.monitors.content-checks.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:read scope", 403);
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
		logger().info("api.v1.monitors.content-checks.list.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("NOT_FOUND", "Monitor not found", 404);
	}

	let contentChecks = await db().query.monitorContentChecks.findMany({
		where(fields, operators) {
			return operators.eq(fields.monitorId, params.monitorId);
		},
		columns: {
			id: true,
			monitorId: true,
			type: true,
			value: true,
			caseSensitive: true,
			isEnabled: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.monitors.content-checks.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		count: contentChecks.length,
	});

	return apiSuccess({ contentChecks });
}

// POST /api/v1/monitors/:monitorId/content-checks - Create a content check
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.content-checks.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.monitors.content-checks.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
	}

	if (!hasScope(apiKey, "monitors:write")) {
		logger().info("api.v1.monitors.content-checks.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:write scope", 403);
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
		logger().info("api.v1.monitors.content-checks.create.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("NOT_FOUND", "Monitor not found", 404);
	}

	let result = await validate(request, createContentCheckSchema);
	if (isFailure(result)) {
		logger().info("api.v1.monitors.content-checks.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
			issues: result.error.issues,
		});
		throw apiError(
			"VALIDATION_ERROR",
			result.error.issues.map((issue) => issue.message).join(", "),
			400,
		);
	}

	let [contentCheck] = await db()
		.insert(schema.monitorContentChecks)
		.values({
			monitorId: monitor.id,
			type: result.data.type,
			value: result.data.value,
			caseSensitive: result.data.caseSensitive ?? false,
			isEnabled: result.data.isEnabled ?? true,
		})
		.returning();

	if (!contentCheck) {
		logger().error("api.v1.monitors.content-checks.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create content check", 500);
	}

	logger().info("api.v1.monitors.content-checks.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		contentCheckId: contentCheck.id,
	});

	return apiSuccess({ contentCheck }, 201);
}
