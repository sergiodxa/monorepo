/**
 * API v1 collection endpoint for DNS monitors: an API-key middleware authenticates the
 * request, the loader lists a team's DNS monitors (dns-monitors:read), and the action
 * validates and creates a new one (dns-monitors:write) with a record type, optional
 * expected value, and check interval. It exists to manage DNS monitors over the public
 * API.
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

import type { Route } from "./+types/v1.dns-monitors";

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

// GET /api/v1/dns-monitors - List all DNS monitors
export async function loader() {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.dns-monitors.list.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
	});

	if (!hasScope(apiKey, "dns-monitors:read")) {
		logger().info("api.v1.dns-monitors.list.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have dns-monitors:read scope", Forbidden);
	}

	let dnsMonitors = await db().query.dnsMonitors.findMany({
		where(fields, operators) {
			return operators.eq(fields.teamId, team.id);
		},
		columns: {
			id: true,
			name: true,
			domain: true,
			recordType: true,
			expectedValue: true,
			intervalSeconds: true,
			isEnabled: true,
			lastCheckedAt: true,
			lastStatus: true,
			lastValue: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	logger().info("api.v1.dns-monitors.list", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		count: dnsMonitors.length,
	});

	return apiSuccess({ dnsMonitors });
}

const createDnsMonitorSchema = z.object({
	name: z.string().min(1).max(255),
	domain: z.string().min(1).max(255),
	recordType: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]),
	expectedValue: z.string().max(1024).optional(),
	intervalSeconds: z.number().int().min(60).max(86400).default(3600),
	isEnabled: z.boolean().default(true),
});

// POST /api/v1/dns-monitors - Create a new DNS monitor
export async function action({ request }: Route.ActionArgs) {
	let { apiKey, team } = apiAuth();

	logger().info("api.v1.dns-monitors.create.start", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		method: request.method,
	});

	if (request.method !== "POST") {
		logger().info("api.v1.dns-monitors.create.method-not-allowed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
			method: request.method,
		});
		throw apiError("METHOD_NOT_ALLOWED", "Only POST method is allowed", MethodNotAllowed);
	}

	if (!hasScope(apiKey, "dns-monitors:write")) {
		logger().info("api.v1.dns-monitors.create.forbidden", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("FORBIDDEN", "API key does not have dns-monitors:write scope", Forbidden);
	}

	let result = await validate(request, createDnsMonitorSchema);
	if (isFailure(result)) {
		logger().info("api.v1.dns-monitors.create.validation-failed", {
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

	let [dnsMonitor] = await db()
		.insert(schema.dnsMonitors)
		.values({
			teamId: team.id,
			name: result.data.name,
			domain: result.data.domain,
			recordType: result.data.recordType,
			expectedValue: result.data.expectedValue,
			intervalSeconds: result.data.intervalSeconds,
			isEnabled: result.data.isEnabled,
		})
		.returning();

	if (!dnsMonitor) {
		logger().error("api.v1.dns-monitors.create.failed", {
			teamId: team.id,
			apiKeyId: apiKey.id,
		});
		throw apiError("INTERNAL_ERROR", "Failed to create DNS monitor", InternalServerError);
	}

	logger().info("api.v1.dns-monitors.create.success", {
		teamId: team.id,
		apiKeyId: apiKey.id,
		dnsMonitorId: dnsMonitor.id,
	});

	return apiSuccess({ dnsMonitor }, Created);
}
