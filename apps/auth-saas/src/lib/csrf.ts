/**
 * CSRF protection utilities.
 * Uses double-submit cookie pattern with signed tokens.
 */

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

	let signature = await sign(payload, secret);

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
	let expectedSignature = await sign(payload, secret);

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

// Crypto utilities

async function sign(input: string, secret: string): Promise<string> {
	let encoder = new TextEncoder();
	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	let signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));

	return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(input: Uint8Array): string {
	let str = btoa(String.fromCharCode(...input));
	return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}
