import { eq } from "drizzle-orm";

import * as schema from "~/db/schema";
import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	Forbidden,
	hasScope,
	MethodNotAllowed,
	NotFound,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.api-keys.$apiKeyId";

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

// DELETE /api/v1/api-keys/:apiKeyId - Delete an API key for the authenticated team
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.api-keys.delete.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		targetApiKeyId: params.apiKeyId,
		method: request.method,
	});

	if (request.method !== "DELETE") {
		logger().info("api.v1.api-keys.delete.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			targetApiKeyId: params.apiKeyId,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only DELETE method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "api-keys:write")) {
		logger().info("api.v1.api-keys.delete.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			targetApiKeyId: params.apiKeyId,
		});
		throw apiError("FORBIDDEN", "API key does not have api-keys:write scope", Forbidden);
	}

	let existingApiKey = await db().query.apiKeys.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.apiKeyId),
				operators.eq(fields.teamId, team.id),
			);
		},
		columns: {
			id: true,
		},
	});

	if (!existingApiKey) {
		logger().info("api.v1.api-keys.delete.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			targetApiKeyId: params.apiKeyId,
		});
		throw apiError("NOT_FOUND", "API key not found", NotFound);
	}

	await db().delete(schema.apiKeys).where(eq(schema.apiKeys.id, existingApiKey.id));

	logger().info("api.v1.api-keys.delete.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		targetApiKeyId: params.apiKeyId,
	});

	return apiSuccess({ deleted: true });
}
