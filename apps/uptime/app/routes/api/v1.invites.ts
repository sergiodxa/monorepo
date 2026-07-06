/**
 * API v1 collection endpoint for team invites: an API-key middleware authenticates the
 * request, the loader lists a team's invites (invites:read), and the action validates
 * an email and creates a new pending invite from the team owner (invites:write). It
 * exists to manage team membership invitations over the public API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

import type { Route } from "./+types/v1.invites";

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

// GET /api/v1/invites - List invites
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.invites.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "invites:read")) {
		logger().info("api.v1.invites.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have invites:read scope", Forbidden);
	}

	let invites = await db().query.invites.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			email: true,
			senderId: true,
			teamId: true,
			acceptedAt: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.invites.list.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: invites.length,
	});

	return apiSuccess({ invites });
}

const createInviteSchema = z.object({
	email: z.string().email(),
});

// POST /api/v1/invites - Create invite
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.invites.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.invites.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "invites:write")) {
		logger().info("api.v1.invites.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have invites:write scope", Forbidden);
	}

	let result = await validate(request, createInviteSchema);
	if (isFailure(result)) {
		logger().info("api.v1.invites.create.validation-failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			issues: result.error.issues,
		});
		throw apiError(
			"VALIDATION_ERROR",
			result.error.issues.map((issue) => issue.message).join(", "),
			BadRequest,
		);
	}

	let [invite] = await db()
		.insert(schema.invites)
		.values({
			email: result.data.email,
			senderId: team.ownerId,
			teamId: team.id,
			acceptedAt: null,
		})
		.returning({
			id: schema.invites.id,
			email: schema.invites.email,
			senderId: schema.invites.senderId,
			teamId: schema.invites.teamId,
			acceptedAt: schema.invites.acceptedAt,
			createdAt: schema.invites.createdAt,
			updatedAt: schema.invites.updatedAt,
		});

	if (!invite) {
		logger().error("api.v1.invites.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create invite", InternalServerError);
	}

	logger().info("api.v1.invites.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		inviteId: invite.id,
	});

	return apiSuccess({ invite }, Created);
}
