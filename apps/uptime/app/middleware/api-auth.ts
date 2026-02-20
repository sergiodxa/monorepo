import type { StatusCode } from "@pkg/http/status-code";

import { json } from "@pkg/http/response";
import {
	BadRequest,
	Conflict,
	Created,
	Forbidden,
	InternalServerError,
	MethodNotAllowed,
	NotFound,
	Ok,
	TooManyRequests,
	Unauthorized,
} from "@pkg/http/status-code";

export {
	BadRequest,
	Conflict,
	Created,
	Forbidden,
	InternalServerError,
	MethodNotAllowed,
	NotFound,
	Ok,
	TooManyRequests,
	Unauthorized,
};
import { eq } from "drizzle-orm";
import { createContext } from "react-router";

import type { ApiKeyScope, SelectApiKey, SelectTeam } from "~/db/schema";

import * as schema from "~/db/schema";

import { getContext } from "./context-storage";
import { db } from "./drizzle";
import { logger } from "./logger";

export interface ApiAuth {
	apiKey: SelectApiKey;
	team: SelectTeam;
}

export const ApiAuthContext = createContext<ApiAuth>();

export function apiAuth() {
	return getContext().get(ApiAuthContext);
}

/**
 * Hash a string using SHA-256
 */
async function hashKey(key: string): Promise<string> {
	let encoder = new TextEncoder();
	let data = encoder.encode(key);
	let hashBuffer = await crypto.subtle.digest("SHA-256", data);
	let hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(request: Request): string | null {
	let authHeader = request.headers.get("Authorization");
	if (!authHeader) return null;

	let match = authHeader.match(/^Bearer\s+(.+)$/i);
	return match?.[1] ?? null;
}

/**
 * Verify API key and return the associated team
 */
export async function verifyApiKey(
	request: Request,
): Promise<{ apiKey: SelectApiKey; team: SelectTeam } | null> {
	let key = extractApiKey(request);
	if (!key) {
		logger().info("api.auth.no-key-extracted");
		return null;
	}

	// Only log the safe prefix (e.g., "uptime_abc1")
	logger().info("api.auth.key-extracted", { keyPrefix: key.slice(0, 12) });

	let keyHash = await hashKey(key);

	let apiKey = await db().query.apiKeys.findFirst({
		where(fields, operators) {
			return operators.eq(fields.keyHash, keyHash);
		},
	});

	if (!apiKey) {
		logger().info("api.auth.key-not-found-in-db");
		return null;
	}

	logger().info("api.auth.key-found", { apiKeyId: apiKey.id, teamId: apiKey.teamId });

	// Check if key is expired
	if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
		logger().info("api.auth.key-expired", { apiKeyId: apiKey.id });
		return null;
	}

	// Get the team
	let team = await db().query.teams.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, apiKey.teamId);
		},
	});

	if (!team) {
		logger().info("api.auth.team-not-found", { teamId: apiKey.teamId });
		return null;
	}

	logger().info("api.auth.verified", { apiKeyId: apiKey.id, teamId: team.id });

	// Update lastUsedAt asynchronously (don't block the request)
	db()
		.update(schema.apiKeys)
		.set({ lastUsedAt: new Date() })
		.where(eq(schema.apiKeys.id, apiKey.id))
		.run();

	return { apiKey, team };
}

/**
 * Check if the API key has the required scope
 */
export function hasScope(apiKey: SelectApiKey, requiredScope: ApiKeyScope): boolean {
	return apiKey.scopes.includes(requiredScope);
}

/**
 * Generate a new API key
 */
export async function generateApiKey(): Promise<{
	key: string;
	keyHash: string;
	keyPrefix: string;
}> {
	// Generate a random 32-byte key
	let randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);
	let key = `uptime_${Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`;

	let keyHash = await hashKey(key);
	let keyPrefix = key.slice(0, 15); // "uptime_" + 8 chars

	return { key, keyHash, keyPrefix };
}

/**
 * Create standard API error response
 */
export function apiError(code: string, message: string, statusCode: StatusCode): Response {
	return json({ error: { code, message } }, statusCode);
}

/**
 * Create standard API success response
 */
export function apiSuccess<T>(data: T, statusCode: StatusCode = Ok): Response {
	return json(
		{
			data,
			meta: {
				requestId: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
			},
		},
		statusCode,
	);
}
