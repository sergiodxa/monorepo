/**
 * Base64URL encoding/decoding utilities.
 * Used for WebAuthn challenges and other binary data.
 */

/**
 * Decodes a Base64URL string to a Uint8Array.
 * @param base64url - Base64URL encoded string
 * @returns Decoded bytes
 */
export function base64UrlDecode(base64url: string): Uint8Array {
	let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	let padding = (4 - (base64.length % 4)) % 4;
	base64 += "=".repeat(padding);
	let binary = atob(base64);
	let bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Encodes a Uint8Array to a Base64URL string.
 * @param bytes - Bytes to encode
 * @returns Base64URL encoded string (no padding)
 */
export function base64UrlEncode(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}
