/**
 * Internal authentication for platform-to-tenant DO communication.
 * Uses HMAC-signed JWTs to securely identify internal requests.
 */

/**
 * Creates a signed internal auth token for platform-to-DO communication.
 * Token is short-lived (5 minutes) to minimize exposure.
 */
export async function createInternalToken(secret: string): Promise<string> {
	let header = { alg: "HS256", typ: "JWT" };
	let payload = {
		iss: "auth-saas-platform",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
		purpose: "internal-api",
	};

	let encodedHeader = base64UrlEncode(JSON.stringify(header));
	let encodedPayload = base64UrlEncode(JSON.stringify(payload));
	let signingInput = `${encodedHeader}.${encodedPayload}`;

	let signature = await sign(signingInput, secret);

	return `${signingInput}.${signature}`;
}

interface InternalTokenPayload {
	iss: string;
	iat: number;
	exp: number;
	purpose: string;
}

/**
 * Verifies an internal auth token.
 * Returns true if the token is valid and not expired.
 */
export async function verifyInternalToken(token: string, secret: string): Promise<boolean> {
	let parts = token.split(".");
	if (parts.length !== 3) return false;

	let encodedHeader = parts[0];
	let encodedPayload = parts[1];
	let signature = parts[2];

	if (!encodedHeader || !encodedPayload || !signature) return false;

	// Verify signature
	let signingInput = `${encodedHeader}.${encodedPayload}`;
	let expectedSignature = await sign(signingInput, secret);

	if (signature !== expectedSignature) return false;

	// Verify payload
	try {
		let payload = JSON.parse(base64UrlDecode(encodedPayload)) as InternalTokenPayload;

		// Check issuer
		if (payload.iss !== "auth-saas-platform") return false;

		// Check purpose
		if (payload.purpose !== "internal-api") return false;

		// Check expiration
		let now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) return false;

		return true;
	} catch {
		return false;
	}
}

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
		str = btoa(input);
	} else {
		str = btoa(String.fromCharCode(...input));
	}
	return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(input: string): string {
	let str = input.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return atob(str);
}
