/**
 * API route that deletes a single pending team invite. Its action requires a
 * DELETE method and the invites:write scope, confirms the invite belongs to the
 * caller's team, and removes it from the database. It exists so teams can rescind
 * outstanding invitations programmatically.
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

import type { Route } from "./+types/v1.invites.$inviteId";

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

// DELETE /api/v1/invites/:inviteId - Delete invite
export async function action({ request, params }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.invites.delete.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		inviteId: params.inviteId,
		method: request.method,
	});

	if (request.method !== "DELETE") {
		logger().info("api.v1.invites.delete.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			inviteId: params.inviteId,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only DELETE method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "invites:write")) {
		logger().info("api.v1.invites.delete.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			inviteId: params.inviteId,
		});
		throw apiError("FORBIDDEN", "API key does not have invites:write scope", Forbidden);
	}

	let invite = await db().query.invites.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.inviteId),
				operators.eq(fields.teamId, team.id),
			);
		},
	});

	if (!invite) {
		logger().info("api.v1.invites.delete.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			inviteId: params.inviteId,
		});
		throw apiError("NOT_FOUND", "Invite not found", NotFound);
	}

	await db().delete(schema.invites).where(eq(schema.invites.id, params.inviteId));

	logger().info("api.v1.invites.delete.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		inviteId: params.inviteId,
	});

	return apiSuccess({ deleted: true });
}
