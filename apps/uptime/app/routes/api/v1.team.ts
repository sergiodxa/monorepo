import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import {
	apiAuth,
	ApiAuthContext,
	apiError,
	apiSuccess,
	BadRequest,
	Forbidden,
	hasScope,
	InternalServerError,
	MethodNotAllowed,
	NotFound,
	Unauthorized,
	verifyApiKey,
} from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

import type { Route } from "./+types/v1.team";

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

// GET /api/v1/team - Get team details
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.team.get.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "teams:read")) {
		logger().info("api.v1.team.get.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have teams:read scope", Forbidden);
	}

	let dbTeam = await db().query.teams.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, team.id);
		},
		columns: {
			id: true,
			name: true,
			slug: true,
			logo: true,
			ownerId: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (!dbTeam) {
		logger().info("api.v1.team.get.not-found", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("NOT_FOUND", "Team not found", NotFound);
	}

	logger().info("api.v1.team.get.success", {
		teamId: dbTeam.id,
		apiKeyId: apiKey.id,
	});

	return apiSuccess({ team: dbTeam });
}

const updateTeamSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		logoUrl: z.string().url().optional(),
	})
	.refine((data) => data.name !== undefined || data.logoUrl !== undefined, {
		message: "At least one field must be provided",
	});

// PUT /api/v1/team - Update team name or logo
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.team.update.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "PUT") {
		logger().info("api.v1.team.update.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only PUT method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "teams:write")) {
		logger().info("api.v1.team.update.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have teams:write scope", Forbidden);
	}

	let result = await validate(request, updateTeamSchema);
	if (isFailure(result)) {
		logger().info("api.v1.team.update.validation-failed", {
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

	let updateData: Partial<schema.InsertTeam> = {};
	if (result.data.name !== undefined) updateData.name = result.data.name;
	if (result.data.logoUrl !== undefined) updateData.logo = result.data.logoUrl;

	let [updatedTeam] = await db()
		.update(schema.teams)
		.set(updateData)
		.where(eq(schema.teams.id, team.id))
		.returning({
			id: schema.teams.id,
			name: schema.teams.name,
			slug: schema.teams.slug,
			logo: schema.teams.logo,
			ownerId: schema.teams.ownerId,
			createdAt: schema.teams.createdAt,
			updatedAt: schema.teams.updatedAt,
		});

	if (!updatedTeam) {
		logger().error("api.v1.team.update.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to update team", InternalServerError);
	}

	logger().info("api.v1.team.update.success", {
		teamId: updatedTeam.id,
		apiKeyId: apiKey.id,
	});

	return apiSuccess({ team: updatedTeam });
}
