/**
 * Shared cryptographic utilities for HMAC signing and constant-time comparison.
 * Used by CSRF, platform sessions, and internal auth modules.
 */

/**
 * Signs input data using HMAC-SHA256 and returns base64url-encoded signature.
 * @param input - The string to sign
 * @param secret - The secret key for HMAC signing
 * @returns Base64url-encoded HMAC-SHA256 signature
 * @throws {Error} If the secret is empty or not provided
 */
export async function hmacSign(input: string, secret: string): Promise<string> {
	if (!secret || secret.length === 0) {
		throw new Error(
			"HMAC secret is required. Ensure SESSION_SECRET and INTERNAL_SECRET are set in .dev.vars or as secrets.",
		);
	}

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
 * Encodes a string or byte array to base64url format (URL-safe base64 without padding).
 * @param input - The string or Uint8Array to encode
 * @returns Base64url-encoded string
 */
export function base64UrlEncode(input: string | Uint8Array): string {
	let str: string;
	if (typeof input === "string") {
		str = btoa(unescape(encodeURIComponent(input)));
	} else {
		str = btoa(String.fromCharCode(...input));
	}
	return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decodes a base64url-encoded string.
 * @param input - The base64url-encoded string to decode
 * @returns The decoded string
 */
export function base64UrlDecode(input: string): string {
	let str = input.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return decodeURIComponent(escape(atob(str)));
}

/**
 * Compares two strings in constant time to prevent timing attacks.
 *
 * Uses XOR comparison across all characters to ensure the comparison
 * takes the same amount of time regardless of where strings differ.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if the strings are equal
 */
export function constantTimeCompare(a: string, b: string): boolean {
	let result = a.length ^ b.length;
	let maxLength = Math.max(a.length, b.length);
	for (let i = 0; i < maxLength; i++) {
		result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}
	return result === 0;
}
