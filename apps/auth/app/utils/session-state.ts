/**
 * OIDC Session Management Session State utilities
 *
 * Per OIDC Session Management 1.0, session_state is computed as:
 * SHA-256(client_id + " " + origin + " " + op_browser_state + " " + salt) + "." + salt
 *
 * @see https://openid.net/specs/openid-connect-session-1_0.html
 */

/**
 * Generate a random salt for session_state
 */
function generateSalt(): string {
	let array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Compute SHA-256 hash of a string
 */
async function sha256(message: string): Promise<string> {
	let encoder = new TextEncoder();
	let data = encoder.encode(message);
	let hashBuffer = await crypto.subtle.digest("SHA-256", data);
	let hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate session_state for an authorization response
 *
 * @param clientId - The client_id of the RP
 * @param redirectUri - The redirect_uri (used to extract origin)
 * @param opBrowserState - The OP's browser state value
 * @returns The session_state value to include in the authorization response
 */
export async function generateSessionState(
	clientId: string,
	redirectUri: string,
	opBrowserState: string,
): Promise<string> {
	let origin = new URL(redirectUri).origin;
	let salt = generateSalt();

	// Per spec: SHA-256(client_id + " " + origin + " " + op_browser_state + " " + salt) + "." + salt
	let input = `${clientId} ${origin} ${opBrowserState} ${salt}`;
	let hash = await sha256(input);

	return `${hash}.${salt}`;
}

/**
 * Generate or retrieve the OP browser state
 *
 * This is a random value that changes when the user's session at the OP changes.
 * It should be stored in a cookie and regenerated on login/logout.
 */
export function generateOpBrowserState(): string {
	let array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Cookie name for the OP browser state
 */
export const OP_BROWSER_STATE_COOKIE = "op_browser_state";
