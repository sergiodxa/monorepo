import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { count, eq } from "drizzle-orm";
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

import type { Route } from "./+types/v1.alerts";

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

// GET /api/v1/alerts - List all alerts
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.alerts.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "alerts:read")) {
		logger().info("api.v1.alerts.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have alerts:read scope", 403);
	}

	let alerts = await db().query.alerts.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			notifyOnRecovery: true,
			cooldownMinutes: true,
			config: true,
			monitorId: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	// Transform config to not expose sensitive data
	let safeAlerts = alerts.map((alert) => ({
		...alert,
		config: {
			strategy: alert.config.strategy,
			// Only expose non-sensitive config fields
			...(alert.config.strategy === "email" && {
				to: alert.config.config.to,
				subjectPrefix: alert.config.config.subjectPrefix,
			}),
			...(alert.config.strategy === "slack" && {
				channel: alert.config.config.channel,
			}),
			// Don't expose webhook URLs, secrets, or discord webhook URLs
		},
	}));

	logger().info("api.v1.alerts.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: alerts.length,
	});

	return apiSuccess({ alerts: safeAlerts });
}

const createAlertSchema = z.discriminatedUnion("strategy", [
	z.object({
		name: z.string().min(1).max(255),
		strategy: z.literal("email"),
		email: z.email(),
		subjectPrefix: z.string().max(100).optional(),
		notifyOnRecovery: z.boolean().default(true),
		cooldownMinutes: z.number().int().min(0).max(1440).default(0),
		monitorId: z.uuid().optional(),
	}),
	z.object({
		name: z.string().min(1).max(255),
		strategy: z.literal("webhook"),
		url: z.url(),
		secret: z.string().max(255).optional(),
		notifyOnRecovery: z.boolean().default(true),
		cooldownMinutes: z.number().int().min(0).max(1440).default(0),
		monitorId: z.uuid().optional(),
	}),
	z.object({
		name: z.string().min(1).max(255),
		strategy: z.literal("slack"),
		webhookUrl: z.url(),
		channel: z.string().max(100).optional(),
		notifyOnRecovery: z.boolean().default(true),
		cooldownMinutes: z.number().int().min(0).max(1440).default(0),
		monitorId: z.uuid().optional(),
	}),
	z.object({
		name: z.string().min(1).max(255),
		strategy: z.literal("discord"),
		webhookUrl: z.url(),
		notifyOnRecovery: z.boolean().default(true),
		cooldownMinutes: z.number().int().min(0).max(1440).default(0),
		monitorId: z.uuid().optional(),
	}),
]);

// POST /api/v1/alerts - Create a new alert
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.alerts.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.alerts.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
	}

	if (!hasScope(apiKey, "alerts:write")) {
		logger().info("api.v1.alerts.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have alerts:write scope", 403);
	}

	// Check alert limit
	let [countResult] = await db()
		.select({ count: count() })
		.from(schema.alerts)
		.where(eq(schema.alerts.teamId, team.id));

	if ((countResult?.count ?? 0) >= 10) {
		logger().info("api.v1.alerts.create.limit-exceeded", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			currentCount: countResult?.count,
		});
		throw apiError("LIMIT_EXCEEDED", "Maximum of 10 alerts per team", 400);
	}

	let result = await validate(request, createAlertSchema);
	if (isFailure(result)) {
		logger().info("api.v1.alerts.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			issues: result.error.issues,
		});
		throw apiError("VALIDATION_ERROR", result.error.issues.map((i) => i.message).join(", "), 400);
	}

	// If monitorId is provided, verify it belongs to this team
	if (result.data.monitorId) {
		let monitor = await db().query.monitors.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.id, result.data.monitorId!),
					operators.eq(fields.teamId, team.id),
				);
			},
			columns: { id: true },
		});

		if (!monitor) {
			logger().info("api.v1.alerts.create.monitor-not-found", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				monitorId: result.data.monitorId,
			});
			throw apiError("NOT_FOUND", "Monitor not found", 404);
		}
	}

	let config: schema.SelectAlert["config"];
	if (result.data.strategy === "email") {
		config = {
			strategy: "email",
			config: {
				to: result.data.email,
				subjectPrefix: result.data.subjectPrefix ?? "",
			},
		};
	} else if (result.data.strategy === "webhook") {
		config = {
			strategy: "webhook",
			config: {
				url: result.data.url,
				secret: result.data.secret ?? "",
			},
		};
	} else if (result.data.strategy === "slack") {
		config = {
			strategy: "slack",
			config: {
				webhookUrl: result.data.webhookUrl,
				channel: result.data.channel,
			},
		};
	} else {
		config = {
			strategy: "discord",
			config: {
				webhookUrl: result.data.webhookUrl,
			},
		};
	}

	let [alert] = await db()
		.insert(schema.alerts)
		.values({
			teamId: team.id,
			name: result.data.name,
			notifyOnRecovery: result.data.notifyOnRecovery,
			cooldownMinutes: result.data.cooldownMinutes,
			monitorId: result.data.monitorId ?? null,
			config,
		})
		.returning();

	if (!alert) {
		logger().error("api.v1.alerts.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create alert", 500);
	}

	logger().info("api.v1.alerts.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		alertId: alert.id,
	});

	return apiSuccess(
		{
			alert: {
				id: alert.id,
				name: alert.name,
				notifyOnRecovery: alert.notifyOnRecovery,
				cooldownMinutes: alert.cooldownMinutes,
				monitorId: alert.monitorId,
				config: { strategy: config.strategy },
				createdAt: alert.createdAt,
				updatedAt: alert.updatedAt,
			},
		},
		201,
	);
}
