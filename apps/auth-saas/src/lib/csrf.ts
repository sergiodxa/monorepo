/**
 * CSRF protection utilities.
 * Uses double-submit cookie pattern with signed tokens.
 */

import { constantTimeCompare, hmacSign } from "~/lib/crypto-utils";

export const CSRF_COOKIE_NAME = "__csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_FORM_FIELD = "_csrf";
export const CSRF_TOKEN_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Generates a new CSRF token.
 * The token is a signed value that includes a timestamp.
 */
export async function generateCsrfToken(secret: string): Promise<string> {
	let timestamp = Date.now().toString(36);
	let random = crypto.randomUUID().replace(/-/g, "");
	let payload = `${timestamp}.${random}`;

	let signature = await hmacSign(payload, secret);

	return `${payload}.${signature}`;
}

/**
 * Verifies a CSRF token.
 * Checks signature validity and that token is not too old.
 */
export async function verifyCsrfToken(
	token: string | null,
	secret: string,
	maxAgeMs: number = CSRF_TOKEN_MAX_AGE * 1000,
): Promise<boolean> {
	if (!token) return false;

	let parts = token.split(".");
	if (parts.length !== 3) return false;

	let [timestamp, random, signature] = parts;
	if (!timestamp || !random || !signature) return false;

	// Verify signature
	let payload = `${timestamp}.${random}`;
	let expectedSignature = await hmacSign(payload, secret);

	if (!constantTimeCompare(signature, expectedSignature)) {
		return false;
	}

	// Check age
	let tokenTime = parseInt(timestamp, 36);
	let now = Date.now();

	if (isNaN(tokenTime) || now - tokenTime > maxAgeMs) {
		return false;
	}

	return true;
}

/**
 * Creates the Set-Cookie header value for a CSRF cookie.
 */
export function createCsrfCookie(token: string, isProduction: boolean): string {
	let parts = [
		`${CSRF_COOKIE_NAME}=${token}`,
		"Path=/",
		"SameSite=Strict",
		`Max-Age=${CSRF_TOKEN_MAX_AGE}`,
	];

	// Note: CSRF cookie should NOT be HttpOnly so JavaScript can read it
	// for setting the header on fetch requests

	if (isProduction) {
		parts.push("Secure");
	}

	return parts.join("; ");
}

/**
 * Extracts CSRF token from request.
 * Checks both header and form field.
 */
export function extractCsrfToken(request: Request, formData?: FormData): string | null {
	// Check header first (for JavaScript-initiated requests)
	let headerToken = request.headers.get(CSRF_HEADER_NAME);
	if (headerToken) return headerToken;

	// Check form field (for traditional form submissions)
	if (formData) {
		let formToken = formData.get(CSRF_FORM_FIELD);
		if (typeof formToken === "string") return formToken;
	}

	return null;
}

/**
 * Extracts cookie value from Cookie header.
 */
export function getCsrfCookie(cookies: string): string | null {
	let match = cookies.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
	return match?.[1] ?? null;
}
