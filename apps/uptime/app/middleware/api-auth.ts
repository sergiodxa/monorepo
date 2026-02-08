import { eq } from "drizzle-orm";
import { createContext } from "react-router";

import type { ApiKeyScope, SelectApiKey, SelectTeam } from "~/db/schema";

import * as schema from "~/db/schema";

import { getContext } from "./context-storage";
import { db } from "./drizzle";

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
	if (!key) return null;

	let keyHash = await hashKey(key);

	let apiKey = await db().query.apiKeys.findFirst({
		where(fields, operators) {
			return operators.eq(fields.keyHash, keyHash);
		},
	});

	if (!apiKey) return null;

	// Check if key is expired
	if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
		return null;
	}

	// Get the team
	let team = await db().query.teams.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, apiKey.teamId);
		},
	});

	if (!team) return null;

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
export function apiError(code: string, message: string, status: number): Response {
	return Response.json(
		{
			error: {
				code,
				message,
			},
		},
		{ status },
	);
}

/**
 * Create standard API success response
 */
export function apiSuccess<T>(data: T, status = 200): Response {
	return Response.json(
		{
			data,
			meta: {
				requestId: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
			},
		},
		{ status },
	);
}
