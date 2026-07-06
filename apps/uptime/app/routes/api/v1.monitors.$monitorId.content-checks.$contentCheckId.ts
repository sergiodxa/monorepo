/**
 * API v1 endpoint that deletes a single content check belonging to a monitor: an
 * API-key middleware authenticates the request and the DELETE action (monitors:write)
 * verifies the check's monitor belongs to the team before removing it. It exists to let
 * API clients remove a monitor's content checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

import type { Route } from "./+types/v1.monitors.$monitorId.content-checks.$contentCheckId";

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

// DELETE /api/v1/monitors/:monitorId/content-checks/:contentCheckId - Delete a content check
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.monitors.content-checks.delete.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		contentCheckId: params.contentCheckId,
		method: request.method,
	});

	if (request.method !== "DELETE") {
		logger().info("api.v1.monitors.content-checks.delete.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
			contentCheckId: params.contentCheckId,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only DELETE method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "monitors:write")) {
		logger().info("api.v1.monitors.content-checks.delete.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
			contentCheckId: params.contentCheckId,
		});
		throw apiError("FORBIDDEN", "API key does not have monitors:write scope", Forbidden);
	}

	let contentCheck = await db().query.monitorContentChecks.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.contentCheckId),
				operators.eq(fields.monitorId, params.monitorId),
			);
		},
		with: {
			monitor: {
				columns: { id: true, teamId: true },
			},
		},
	});

	if (!contentCheck || contentCheck.monitor?.teamId !== team.id) {
		logger().info("api.v1.monitors.content-checks.delete.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			monitorId: params.monitorId,
			contentCheckId: params.contentCheckId,
		});
		throw apiError("NOT_FOUND", "Content check not found", NotFound);
	}

	await db()
		.delete(schema.monitorContentChecks)
		.where(eq(schema.monitorContentChecks.id, params.contentCheckId));

	logger().info("api.v1.monitors.content-checks.delete.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		monitorId: params.monitorId,
		contentCheckId: params.contentCheckId,
	});

	return apiSuccess({ success: true });
}
