/**
 * Server-side verification for a Cloudflare Turnstile response token, run
 * under the platform's own site key and secret in managed mode, so no tenant
 * holds a third-party account of its own. A caller distinguishes a token
 * Turnstile itself rejected from a verification call that could not
 * complete, since a sign-up refuses on either while a sign-in or reset lets
 * the second kind through — a vendor outage should not stop every tenant's
 * users at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Cloudflare's own Turnstile verification endpoint. */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** A token Turnstile confirmed. */
export interface TurnstileVerified {
	ok: true;
}

/** A token Turnstile refused, or a verification call that could not complete. */
export interface TurnstileRefused {
	ok: false;
	/**
	 * `"invalid-token"` when Turnstile itself answered the token was no good;
	 * `"verification-unavailable"` when the call could not be reached or
	 * answered in a shape this function does not recognize.
	 */
	reason: "invalid-token" | "verification-unavailable";
}

export type TurnstileVerification = TurnstileVerified | TurnstileRefused;

/** The `siteverify` response fields this function reads. */
interface SiteverifyResponse {
	success: boolean;
}

/**
 * Verifies a Turnstile response token against Cloudflare's `siteverify`
 * endpoint.
 *
 * @param secretKey - The platform's Turnstile secret key (`TURNSTILE_SECRET_KEY`).
 * @param token - The `cf-turnstile-response` field a form submitted.
 * @param remoteIp - The connecting address, when known, passed on for Turnstile's own risk signal.
 * @returns `{ ok: true }` once Turnstile confirms the token, or `{ ok: false, reason }`
 * naming whether the token itself was refused or the verification call could not complete.
 * @example
 * let verified = await verifyTurnstileToken(env.TURNSTILE_SECRET_KEY, token, getClientIP(request) ?? undefined);
 */
export async function verifyTurnstileToken(
	secretKey: string,
	token: string,
	remoteIp?: string,
): Promise<TurnstileVerification> {
	let requestBody = new URLSearchParams({ secret: secretKey, response: token });
	if (remoteIp) requestBody.set("remoteip", remoteIp);

	let response: Response;
	try {
		response = await fetch(SITEVERIFY_URL, { method: "POST", body: requestBody });
	} catch {
		return { ok: false, reason: "verification-unavailable" };
	}

	if (!response.ok) return { ok: false, reason: "verification-unavailable" };

	let responseBody: unknown;
	try {
		responseBody = await response.json();
	} catch {
		return { ok: false, reason: "verification-unavailable" };
	}

	if (!isSiteverifyResponse(responseBody)) return { ok: false, reason: "verification-unavailable" };

	return responseBody.success ? { ok: true } : { ok: false, reason: "invalid-token" };
}

/**
 * Narrows an unknown, already-parsed JSON body to the one field this module
 * reads from Cloudflare's `siteverify` answer.
 *
 * @param body - The parsed response body.
 * @returns Whether `body` carries a boolean `success` field.
 */
function isSiteverifyResponse(body: unknown): body is SiteverifyResponse {
	return (
		typeof body === "object" &&
		body !== null &&
		"success" in body &&
		typeof body.success === "boolean"
	);
}
