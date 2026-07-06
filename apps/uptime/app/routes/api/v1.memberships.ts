/**
 * API route that lists the memberships of the authenticated team. Its loader
 * requires the teams:read scope and returns each member's id, subject, role, and
 * timestamps ordered by creation date. It exists so teams can enumerate who
 * belongs to them and with what role via the API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	Forbidden,
	hasScope,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.memberships";

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

// GET /api/v1/memberships - List team memberships
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.memberships.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "teams:read")) {
		logger().info("api.v1.memberships.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have teams:read scope", Forbidden);
	}

	let memberships = await db().query.memberships.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			subjectId: true,
			teamId: true,
			role: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.memberships.list.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: memberships.length,
	});

	return apiSuccess({ memberships });
}
