/**
 * Platform session cookie utilities.
 * Uses HMAC-signed tokens to securely store session data without database lookups.
 */

import type { JSONValue } from "@pkg/types";

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import { base64UrlDecode, base64UrlEncode, constantTimeCompare, hmacSign } from "./crypto-utils";

/**
 * Cookie name for platform sessions.
 */
export const PLATFORM_SESSION_COOKIE = "__platform_session";

/**
 * Session cookie max age in seconds (30 days).
 */
export const PLATFORM_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Schema for validating session token payloads.
 */
const SessionPayloadSchema = s.object({
	/** Subject ID (user UUID) */
	sub: s.string(),
	/** Email address */
	email: s.string(),
	/** Tenant session ID (from ID token sid claim) */
	sid: s.optional(s.string()),
	/** Issued at timestamp (seconds) */
	iat: s.number(),
	/** Expiration timestamp (seconds) */
	exp: s.number(),
});

/**
 * Session payload type inferred from the schema.
 */
type SessionPayload = s.InferOutput<typeof SessionPayloadSchema>;

/**
 * Creates a signed session token containing user information.
 * The token is self-contained and can be verified without a database lookup.
 * @param subjectId - The user's UUID
 * @param email - The user's email address
 * @param secret - The secret key for signing
 * @param sessionId - Optional tenant session ID (from ID token sid claim)
 * @returns A signed session token string
 */
export async function createSessionToken(
	subjectId: string,
	email: string,
	secret: string,
	sessionId?: string,
): Promise<string> {
	let now = Math.floor(Date.now() / 1000);
	let payload: SessionPayload = {
		sub: subjectId,
		email: email,
		sid: sessionId,
		iat: now,
		exp: now + PLATFORM_SESSION_MAX_AGE,
	};

	let encodedPayload = base64UrlEncode(JSON.stringify(payload));
	let signature = await hmacSign(encodedPayload, secret);

	return `${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes a session token.
 *
 * Uses constant-time comparison for signature verification to prevent timing attacks.
 *
 * @param token - The session token to verify
 * @param secret - The secret key used for signing
 * @returns The decoded session data, or null if invalid/expired
 */
export async function verifySessionToken(
	token: string,
	secret: string,
): Promise<{ subjectId: string; email: string; sessionId?: string } | null> {
	let parts = token.split(".");
	if (parts.length !== 2) return null;

	let [encodedPayload, signature] = parts;
	if (!encodedPayload || !signature) return null;

	let expectedSignature = await hmacSign(encodedPayload, secret);
	if (!constantTimeCompare(signature, expectedSignature)) {
		return null;
	}

	try {
		let parsed: unknown;
		try {
			parsed = JSON.parse(base64UrlDecode(encodedPayload));
		} catch {
			return null;
		}

		let result = await validate(parsed as JSONValue, SessionPayloadSchema);
		if (isFailure(result)) {
			return null;
		}

		let payload = result.data;

		let now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) {
			return null;
		}

		return {
			subjectId: payload.sub,
			email: payload.email,
			sessionId: payload.sid,
		};
	} catch {
		return null;
	}
}

/**
 * Creates the Set-Cookie header value for a session cookie.
 * @param token - The session token to store
 * @param isProduction - Whether to add the Secure flag
 * @returns The Set-Cookie header value
 */
export function createSessionCookie(token: string, isProduction: boolean): string {
	let parts = [
		`${PLATFORM_SESSION_COOKIE}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${PLATFORM_SESSION_MAX_AGE}`,
	];

	if (isProduction) {
		parts.push("Secure");
	}

	return parts.join("; ");
}

/**
 * Creates a Set-Cookie header value to clear the session cookie.
 * @returns The Set-Cookie header value with Max-Age=0
 */
export function clearSessionCookie(): string {
	return `${PLATFORM_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Extracts a cookie value from the Cookie header.
 * @param cookies - The Cookie header string
 * @param name - The cookie name to extract
 * @returns The cookie value, or null if not found
 */
export function getCookie(cookies: string, name: string): string | null {
	let match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match?.[1] ?? null;
}
