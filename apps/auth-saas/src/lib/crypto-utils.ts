/**
 * Shared cryptographic utilities for HMAC signing and constant-time comparison.
 * Used by CSRF, platform sessions, and internal auth modules.
 */

/**
 * Signs input data using HMAC-SHA256 and returns base64url-encoded signature.
 */
export async function hmacSign(input: string, secret: string): Promise<string> {
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

/**
 * Encodes a string to base64url format (URL-safe base64 without padding).
 */
export function base64UrlEncode(input: string | Uint8Array): string {
	let str: string;
	if (typeof input === "string") {
		// For strings, properly encode UTF-8 characters
		str = btoa(unescape(encodeURIComponent(input)));
	} else {
		str = btoa(String.fromCharCode(...input));
	}
	return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decodes a base64url-encoded string.
 */
export function base64UrlDecode(input: string): string {
	let str = input.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return decodeURIComponent(escape(atob(str)));
}

/**
 * Compares two strings in constant time to prevent timing attacks.
 * Returns true if the strings are equal.
 */
export function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}
