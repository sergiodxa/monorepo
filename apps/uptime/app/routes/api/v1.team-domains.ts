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
	Created,
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

import type { Route } from "./+types/v1.team-domains";

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

// GET /api/v1/team-domains - List team domains
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.team-domains.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "team-domains:read")) {
		logger().info("api.v1.team-domains.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have team-domains:read scope", Forbidden);
	}

	let teamDomains = await db().query.teamDomains.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			hostname: true,
			verifiedAt: true,
			teamId: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.team-domains.list.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: teamDomains.length,
	});

	return apiSuccess({ teamDomains });
}

const createTeamDomainSchema = z.object({
	hostname: z.string().min(1).max(255),
});

const deleteTeamDomainSchema = z.object({
	id: z.string().uuid(),
});

// POST /api/v1/team-domains - Add domain
// DELETE /api/v1/team-domains - Delete domain by id
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.team-domains.action.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (!hasScope(apiKey, "team-domains:write")) {
		logger().info("api.v1.team-domains.action.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("FORBIDDEN", "API key does not have team-domains:write scope", Forbidden);
	}

	if (request.method === "POST") {
		let result = await validate(request, createTeamDomainSchema);
		if (isFailure(result)) {
			logger().info("api.v1.team-domains.create.validation-failed", {
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

		let [teamDomain] = await db()
			.insert(schema.teamDomains)
			.values({
				hostname: result.data.hostname,
				teamId: team.id,
			})
			.returning({
				id: schema.teamDomains.id,
				hostname: schema.teamDomains.hostname,
				verifiedAt: schema.teamDomains.verifiedAt,
				teamId: schema.teamDomains.teamId,
				createdAt: schema.teamDomains.createdAt,
				updatedAt: schema.teamDomains.updatedAt,
			});

		if (!teamDomain) {
			logger().error("api.v1.team-domains.create.failed", {
				teamId: team.id,
				apiKeyId: apiKey.id,
			});
			throw apiError("INTERNAL_ERROR", "Failed to add team domain", InternalServerError);
		}

		logger().info("api.v1.team-domains.create.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			teamDomainId: teamDomain.id,
		});

		return apiSuccess({ teamDomain }, Created);
	}

	if (request.method === "DELETE") {
		let result = await validate(request, deleteTeamDomainSchema);
		if (isFailure(result)) {
			logger().info("api.v1.team-domains.delete.validation-failed", {
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

		let teamDomain = await db().query.teamDomains.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.id, result.data.id),
					operators.eq(fields.teamId, team.id),
				);
			},
		});

		if (!teamDomain) {
			logger().info("api.v1.team-domains.delete.not-found", {
				teamId: team.id,
				apiKeyId: apiKey.id,
				teamDomainId: result.data.id,
			});
			throw apiError("NOT_FOUND", "Team domain not found", NotFound);
		}

		await db().delete(schema.teamDomains).where(eq(schema.teamDomains.id, result.data.id));

		logger().info("api.v1.team-domains.delete.success", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			teamDomainId: result.data.id,
		});

		return apiSuccess({ deleted: true });
	}

	logger().info("api.v1.team-domains.action.method-not-allowed", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});
	throw apiError(
		"METHOD_NOT_ALLOWED",
		"Only POST and DELETE methods are allowed for this endpoint",
		MethodNotAllowed,
	);
}
