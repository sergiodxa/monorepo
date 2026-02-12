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
	generateApiKey,
	hasScope,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.api-keys";

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

// GET /api/v1/api-keys - List API keys for the authenticated team
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.api-keys.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "api-keys:read")) {
		logger().info("api.v1.api-keys.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have api-keys:read scope", 403);
	}

	let apiKeys = await db().query.apiKeys.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			scopes: true,
			createdAt: true,
			lastUsedAt: true,
			expiresAt: true,
			keyPrefix: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.api-keys.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: apiKeys.length,
	});

	return apiSuccess({ apiKeys });
}

const scopeEnum = z.enum(schema.apiKeyScopes);

const createApiKeySchema = z.object({
	name: z.string().min(1).max(255),
	scopes: z.array(scopeEnum).min(1),
	expiresAt: z.preprocess(
		(val) => (val === "" || val === null || val === undefined ? undefined : val),
		z.coerce.date().optional(),
	),
});

// POST /api/v1/api-keys - Create a new API key for the authenticated team
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.api-keys.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.api-keys.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
	}

	if (!hasScope(apiKey, "api-keys:write")) {
		logger().info("api.v1.api-keys.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have api-keys:write scope", 403);
	}

	let result = await validate(request, createApiKeySchema);
	if (isFailure(result)) {
		logger().info("api.v1.api-keys.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			issues: result.error.issues,
		});
		throw apiError(
			"VALIDATION_ERROR",
			result.error.issues.map((issue) => issue.message).join(", "),
			400,
		);
	}

	let [countResult] = await db()
		.select({ count: count() })
		.from(schema.apiKeys)
		.where(eq(schema.apiKeys.teamId, team.id));

	if ((countResult?.count ?? 0) >= 10) {
		logger().info("api.v1.api-keys.create.limit-exceeded", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			currentCount: countResult?.count ?? 0,
			limit: 10,
		});
		throw apiError("LIMIT_EXCEEDED", "API key limit reached for this team", 400);
	}

	let { key, keyHash, keyPrefix } = await generateApiKey();

	let [newApiKey] = await db()
		.insert(schema.apiKeys)
		.values({
			teamId: team.id,
			name: result.data.name,
			keyHash,
			keyPrefix,
			scopes: result.data.scopes,
			expiresAt: result.data.expiresAt ?? null,
		})
		.returning();

	if (!newApiKey) {
		logger().error("api.v1.api-keys.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			name: result.data.name,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create API key", 500);
	}

	logger().info("api.v1.api-keys.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		newApiKeyId: newApiKey.id,
	});

	return apiSuccess(
		{
			apiKey: {
				id: newApiKey.id,
				name: newApiKey.name,
				scopes: newApiKey.scopes,
				createdAt: newApiKey.createdAt,
				lastUsedAt: newApiKey.lastUsedAt,
				expiresAt: newApiKey.expiresAt,
				keyPrefix: newApiKey.keyPrefix,
			},
			key,
		},
		201,
	);
}
