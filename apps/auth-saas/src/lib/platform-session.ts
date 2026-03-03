/**
 * Platform session cookie utilities.
 * Uses HMAC-signed tokens to securely store session data without database lookups.
 */

import type { JSONValue } from "@pkg/types";

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import {
	base64UrlDecode,
	base64UrlEncode,
	constantTimeCompare,
	hmacSign,
} from "~/lib/crypto-utils";

export const PLATFORM_SESSION_COOKIE = "__platform_session";
export const PLATFORM_SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

const SessionPayloadSchema = s.object({
	/** Subject ID (user UUID) */
	sub: s.string(),
	/** Email address */
	email: s.string(),
	/** Issued at timestamp (seconds) */
	iat: s.number(),
	/** Expiration timestamp (seconds) */
	exp: s.number(),
});

type SessionPayload = s.InferOutput<typeof SessionPayloadSchema>;

/**
 * Creates a signed session token containing user information.
 * The token is self-contained and can be verified without a database lookup.
 */
export async function createSessionToken(
	subjectId: string,
	email: string,
	secret: string,
): Promise<string> {
	let now = Math.floor(Date.now() / 1000);
	let payload: SessionPayload = {
		sub: subjectId,
		email: email,
		iat: now,
		exp: now + PLATFORM_SESSION_MAX_AGE,
	};

	let encodedPayload = base64UrlEncode(JSON.stringify(payload));
	let signature = await hmacSign(encodedPayload, secret);

	return `${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes a session token.
 * Returns null if the token is invalid, expired, or signature doesn't match.
 */
export async function verifySessionToken(
	token: string,
	secret: string,
): Promise<{ subjectId: string; email: string } | null> {
	let parts = token.split(".");
	if (parts.length !== 2) return null;

	let [encodedPayload, signature] = parts;
	if (!encodedPayload || !signature) return null;

	// Verify signature using constant-time comparison
	let expectedSignature = await hmacSign(encodedPayload, secret);
	if (!constantTimeCompare(signature, expectedSignature)) {
		return null;
	}

	// Decode and validate payload
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

		// Check expiration
		let now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) {
			return null;
		}

		return {
			subjectId: payload.sub,
			email: payload.email,
		};
	} catch {
		return null;
	}
}

/**
 * Creates the Set-Cookie header value for a session cookie.
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
 */
export function clearSessionCookie(): string {
	return `${PLATFORM_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Extracts a cookie value from the Cookie header.
 */
export function getCookie(cookies: string, name: string): string | null {
	let match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match?.[1] ?? null;
}
