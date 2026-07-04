/**
 * Internal authentication for platform-to-tenant DO communication.
 * Uses HMAC-signed JWTs to securely identify internal requests.
 */

import type { JSONValue } from "@pkg/types";

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import { base64UrlDecode, base64UrlEncode, constantTimeCompare, hmacSign } from "./crypto-utils";

/**
 * Schema for validating internal token payloads.
 */
const InternalTokenPayloadSchema = s.object({
	iss: s.string(),
	iat: s.number(),
	exp: s.number(),
	purpose: s.string(),
});

/**
 * Creates a signed internal auth token for platform-to-DO communication.
 * Token is short-lived (5 minutes) to minimize exposure window if compromised.
 * @param secret - The secret key for signing the token
 * @returns A signed JWT token string
 */
export async function createInternalToken(secret: string): Promise<string> {
	let header = { alg: "HS256", typ: "JWT" };
	let payload = {
		iss: "auth-saas-platform",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 300,
		purpose: "internal-api",
	};

	let encodedHeader = base64UrlEncode(JSON.stringify(header));
	let encodedPayload = base64UrlEncode(JSON.stringify(payload));
	let signingInput = `${encodedHeader}.${encodedPayload}`;

	let signature = await hmacSign(signingInput, secret);

	return `${signingInput}.${signature}`;
}

/**
 * Verifies an internal auth token.
 *
 * Uses constant-time comparison for signature verification to prevent timing attacks.
 *
 * @param token - The JWT token to verify
 * @param secret - The secret key used for signing
 * @returns True if the token is valid and not expired
 */
export async function verifyInternalToken(token: string, secret: string): Promise<boolean> {
	let parts = token.split(".");
	if (parts.length !== 3) return false;

	let encodedHeader = parts[0];
	let encodedPayload = parts[1];
	let signature = parts[2];

	if (!encodedHeader || !encodedPayload || !signature) return false;

	let signingInput = `${encodedHeader}.${encodedPayload}`;
	let expectedSignature = await hmacSign(signingInput, secret);

	if (!constantTimeCompare(signature, expectedSignature)) return false;

	try {
		let parsed: unknown;
		try {
			parsed = JSON.parse(base64UrlDecode(encodedPayload));
		} catch {
			return false;
		}

		let result = await validate(parsed as JSONValue, InternalTokenPayloadSchema);
		if (isFailure(result)) return false;

		let payload = result.data;

		if (payload.iss !== "auth-saas-platform") return false;
		if (payload.purpose !== "internal-api") return false;

		let now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) return false;

		return true;
	} catch {
		return false;
	}
}
