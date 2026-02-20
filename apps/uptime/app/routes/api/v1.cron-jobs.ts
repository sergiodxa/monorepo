import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	BadRequest,
	Created,
	Forbidden,
	hasScope,
	InternalServerError,
	MethodNotAllowed,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.cron-jobs";

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

// GET /api/v1/cron-jobs - List all cron jobs
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.cron-jobs.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "cron-jobs:read")) {
		logger().info("api.v1.cron-jobs.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have cron-jobs:read scope", Forbidden);
	}

	let cronJobs = await db().query.cronJobMonitors.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			description: true,
			cronExpression: true,
			gracePeriodSeconds: true,
			timezone: true,
			status: true,
			alertOnLate: true,
			lastPingAt: true,
			nextExpectedAt: true,
			enabledAt: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.cron-jobs.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: cronJobs.length,
	});

	return apiSuccess({ cronJobs });
}

const createCronJobSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	cronExpression: z.string().min(1),
	gracePeriodSeconds: z.number().int().min(60).max(86400).default(300),
	timezone: z.string().default("UTC"),
	alertOnLate: z.boolean().default(false),
	enabled: z.boolean().default(true),
});

// POST /api/v1/cron-jobs - Create a new cron job
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.cron-jobs.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.cron-jobs.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "cron-jobs:write")) {
		logger().info("api.v1.cron-jobs.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have cron-jobs:write scope", Forbidden);
	}

	let result = await validate(request, createCronJobSchema);
	if (isFailure(result)) {
		logger().info("api.v1.cron-jobs.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			issues: result.error.issues,
		});
		throw apiError(
			"VALIDATION_ERROR",
			result.error.issues.map((i) => i.message).join(", "),
			BadRequest,
		);
	}

	// Validate cron expression using cron-parser
	let CronExpressionParser = await import("cron-parser").then((m) => m.default);
	let nextExpectedAt: Date | null = null;
	try {
		let interval = CronExpressionParser.parse(result.data.cronExpression, {
			tz: result.data.timezone,
		});
		nextExpectedAt = interval.next().toDate();
	} catch {
		logger().info("api.v1.cron-jobs.create.invalid-cron-expression", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			cronExpression: result.data.cronExpression,
		});
		throw apiError("VALIDATION_ERROR", "Invalid cron expression", BadRequest);
	}

	let [cronJob] = await db()
		.insert(schema.cronJobMonitors)
		.values({
			teamId: team.id,
			name: result.data.name,
			description: result.data.description,
			cronExpression: result.data.cronExpression,
			gracePeriodSeconds: result.data.gracePeriodSeconds,
			timezone: result.data.timezone,
			alertOnLate: result.data.alertOnLate,
			enabledAt: result.data.enabled ? new Date() : null,
			nextExpectedAt,
		})
		.returning();

	if (!cronJob) {
		logger().error("api.v1.cron-jobs.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create cron job", InternalServerError);
	}

	logger().info("api.v1.cron-jobs.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		cronJobId: cronJob.id,
	});

	return apiSuccess({ cronJob }, Created);
}
