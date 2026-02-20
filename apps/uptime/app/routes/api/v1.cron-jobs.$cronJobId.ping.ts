import { z } from "zod/v4";

import * as schema from "~/db/schema";
import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	Conflict,
	Created,
	Forbidden,
	hasScope,
	MethodNotAllowed,
	NotFound,
	TooManyRequests,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Customer from "~/models/customer";

import type { Route } from "./+types/v1.cron-jobs.$cronJobId.ping";

export const middleware: Route.MiddlewareFunction[] = [
	async ({ request, context }, next) => {
		let hasAuthHeader = request.headers.has("Authorization");
		let url = new URL(request.url);

		logger().info("api.middleware.auth.start", {
			hasAuthHeader,
			path: url.pathname,
			method: request.method,
		});

		let auth = await verifyApiKey(request);
		if (!auth) {
			logger().info("api.middleware.auth.failed", { hasAuthHeader });
			throw apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);
		}

		logger().info("api.middleware.auth.success", {
			teamId: auth.team.id,
			apiKeyId: auth.apiKey.id,
		});

		context.set(ApiAuthContext, auth);
		return await next();
	},
];

const RATE_LIMIT_SECONDS = 60;

// GET /api/v1/cron-jobs/:cronJobId/ping - Get ping history
export async function loader({ request, params }: Route.LoaderArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.cron-jobs.ping.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: params.cronJobId,
	});

	if (!hasScope(apiKey, "cron-jobs:read")) {
		logger().info("api.v1.cron-jobs.ping.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
		});
		throw apiError("FORBIDDEN", "API key does not have cron-jobs:read scope", Forbidden);
	}

	// Verify the cron job belongs to this team
	let cronJob = await db().query.cronJobMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.cronJobId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: { id: true },
	});

	if (!cronJob) {
		throw apiError("NOT_FOUND", "Cron job not found", NotFound);
	}

	// Parse query parameters for pagination
	let url = new URL(request.url);
	let limitParam = url.searchParams.get("limit");
	let offsetParam = url.searchParams.get("offset");

	let limitSchema = z.coerce.number().int().min(1).max(100).default(50);
	let offsetSchema = z.coerce.number().int().min(0).default(0);

	let limit = limitSchema.parse(limitParam ?? 50);
	let offset = offsetSchema.parse(offsetParam ?? 0);

	let pings = await db().query.cronJobPings.findMany({
		where(fields, operators) {
			return operators.eq(fields.cronJobMonitorId, params.cronJobId);
		},
		columns: {
			id: true,
			wasOnTime: true,
			sourceIp: true,
			userAgent: true,
			createdAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
		limit: limit + 1, // Fetch one extra to check if there are more
		offset,
	});

	let hasMore = pings.length > limit;
	if (hasMore) {
		pings = pings.slice(0, limit);
	}

	logger().info("api.v1.cron-jobs.ping.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: params.cronJobId,
		count: pings.length,
		limit,
		offset,
	});

	return apiSuccess({
		pings,
		pagination: {
			limit,
			offset,
			hasMore,
		},
	});
}

// POST /api/v1/cron-jobs/:cronJobId/ping - Record a ping
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.cron-jobs.ping.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: params.cronJobId,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.cron-jobs.ping.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "cron-jobs:ping")) {
		logger().info("api.v1.cron-jobs.ping.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
		});
		throw apiError("FORBIDDEN", "API key does not have cron-jobs:ping scope", Forbidden);
	}

	// Find the cron job and verify it belongs to this team
	let cronJob = await db().query.cronJobMonitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.cronJobId),
				operators.eq(fields.teamId, team.id),
			);
		},
		with: {
			team: {
				columns: { id: true, ownerId: true },
			},
		},
	});

	if (!cronJob) {
		logger().info("api.v1.cron-jobs.ping.create.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: params.cronJobId,
		});
		throw apiError("NOT_FOUND", "Cron job not found", NotFound);
	}

	// Check if cron job is enabled
	if (!cronJob.enabledAt) {
		logger().info("api.v1.cron-jobs.ping.create.disabled", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronJobId: cronJob.id,
		});
		throw apiError("CONFLICT", "Cron job is disabled", Conflict);
	}

	// Check rate limiting (1 ping per minute)
	let now = new Date();
	if (cronJob.lastPingAt) {
		let timeSinceLastPing = (now.getTime() - cronJob.lastPingAt.getTime()) / 1000;
		if (timeSinceLastPing < RATE_LIMIT_SECONDS) {
			logger().info("api.v1.cron-jobs.ping.rate-limited", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				cronJobId: cronJob.id,
				timeSinceLastPing,
			});
			throw apiError(
				"RATE_LIMITED",
				"Rate limit exceeded. Max 1 ping per minute.",
				TooManyRequests,
			);
		}
	}

	// Determine if the ping was on time
	let wasOnTime = true;
	if (cronJob.nextExpectedAt) {
		let gracePeriodMs = cronJob.gracePeriodSeconds * 1000;
		let deadlineAt = new Date(cronJob.nextExpectedAt.getTime() + gracePeriodMs);
		wasOnTime = now <= deadlineAt;
	}

	// Calculate next expected time
	let CronExpressionParser = await import("cron-parser").then((m) => m.default);
	let nextExpectedAt: Date | null = null;
	try {
		let interval = CronExpressionParser.parse(cronJob.cronExpression, {
			tz: cronJob.timezone,
		});
		nextExpectedAt = interval.next().toDate();
	} catch {
		// Should not happen with existing valid cron expression
		logger().error("api.v1.cron-jobs.ping.invalid-cron-expression", {
			cronJobId: cronJob.id,
			cronExpression: cronJob.cronExpression,
		});
	}

	// Get source IP and user agent
	let sourceIp = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For");
	let userAgent = request.headers.get("User-Agent");

	// Record the ping
	let [ping] = await db()
		.insert(schema.cronJobPings)
		.values({
			cronJobMonitorId: cronJob.id,
			wasOnTime,
			sourceIp,
			userAgent,
		})
		.returning();

	// Update cron job status
	let { eq } = await import("drizzle-orm");
	await db()
		.update(schema.cronJobMonitors)
		.set({
			lastPingAt: now,
			nextExpectedAt,
			status: wasOnTime ? "healthy" : "late",
		})
		.where(eq(schema.cronJobMonitors.id, cronJob.id));

	// Ingest billing usage
	try {
		await Customer.ingest(cronJob.team.ownerId, {
			monitorId: cronJob.id,
			resultId: ping?.id ?? "",
			teamId: cronJob.team.id,
		});
	} catch (error) {
		// Log but don't fail the request
		logger().error("api.v1.cron-jobs.ping.billing-ingest-failed", {
			cronJobId: cronJob.id,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	logger().info("api.v1.cron-jobs.ping.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: cronJob.id,
		pingId: ping?.id,
		wasOnTime,
	});

	return apiSuccess(
		{
			ping: {
				id: ping?.id,
				wasOnTime,
				createdAt: ping?.createdAt,
			},
		},
		Created,
	);
}
