/**
 * Platform session cookie utilities.
 * Uses HMAC-signed tokens to securely store session data without database lookups.
 */

export const PLATFORM_SESSION_COOKIE = "__platform_session";
export const PLATFORM_SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

interface SessionPayload {
	/** Subject ID (user UUID) */
	sub: string;
	/** Email address */
	email: string;
	/** Issued at timestamp (seconds) */
	iat: number;
	/** Expiration timestamp (seconds) */
	exp: number;
}

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
	let signature = await sign(encodedPayload, secret);

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
	let expectedSignature = await sign(encodedPayload, secret);
	if (!constantTimeCompare(signature, expectedSignature)) {
		return null;
	}

	// Decode and validate payload
	try {
		let payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

		// Check expiration
		let now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) {
			return null;
		}

		// Validate required fields
		if (!payload.sub || !payload.email) {
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

function base64UrlEncode(input: string | Uint8Array): string {
	let str: string;
	if (typeof input === "string") {
		str = btoa(unescape(encodeURIComponent(input)));
	} else {
		str = btoa(String.fromCharCode(...input));
	}
	return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(input: string): string {
	let str = input.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return decodeURIComponent(escape(atob(str)));
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}
