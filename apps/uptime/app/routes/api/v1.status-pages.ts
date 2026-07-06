/**
 * API v1 collection endpoint for status pages: an API-key middleware authenticates the
 * request, the loader lists a team's status pages (status-pages:read), and the action
 * validates and creates a new one (status-pages:write) with a unique slug and display
 * options. It exists to manage status pages over the public API.
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

import type { Route } from "./+types/v1.status-pages";

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

// GET /api/v1/status-pages - List status pages
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.status-pages.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "status-pages:read")) {
		logger().info("api.v1.status-pages.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have status-pages:read scope", Forbidden);
	}

	let statusPages = await db().query.statusPages.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			slug: true,
			title: true,
			description: true,
			logoUrl: true,
			customDomain: true,
			isPublic: true,
			showOverallStatus: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.status-pages.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: statusPages.length,
	});

	return apiSuccess({ statusPages });
}

const createStatusPageSchema = z.object({
	name: z.string().min(1).max(255),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
	title: z.string().min(1).max(255).optional(),
	description: z.string().max(500).optional(),
	logoUrl: z.string().url().optional(),
	customDomain: z.string().min(1).optional(),
	isPublic: z.boolean().default(true),
	showOverallStatus: z.boolean().default(true),
});

// POST /api/v1/status-pages - Create a status page
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.status-pages.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.status-pages.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "status-pages:write")) {
		logger().info("api.v1.status-pages.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have status-pages:write scope", Forbidden);
	}

	let result = await validate(request, createStatusPageSchema);
	if (isFailure(result)) {
		logger().info("api.v1.status-pages.create.validation-failed", {
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

	let [statusPage] = await db()
		.insert(schema.statusPages)
		.values({
			teamId: team.id,
			name: result.data.name,
			slug: result.data.slug,
			title: result.data.title ?? result.data.name,
			description: result.data.description ?? null,
			logoUrl: result.data.logoUrl ?? null,
			customDomain: result.data.customDomain ?? null,
			isPublic: result.data.isPublic,
			showOverallStatus: result.data.showOverallStatus,
		})
		.returning();

	if (!statusPage) {
		logger().error("api.v1.status-pages.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create status page", InternalServerError);
	}

	logger().info("api.v1.status-pages.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		statusPageId: statusPage.id,
	});

	return apiSuccess({ statusPage }, Created);
}
