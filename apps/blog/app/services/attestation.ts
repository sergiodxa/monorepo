/**
 * Remembers that the visitor's device redeemed a Privacy Pass token, in a signed cookie of its
 * own that expires after {@link ATTESTATION_TTL_SECONDS}. It stays out of the session, so an
 * attested visitor keeps reading edge-cached pages as anonymous.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCookie } from "remix/cookie";

import { getEnv } from "~/app/http/middleware/env";

/** How long a redemption vouches for the visitor: long enough to write a message. */
export const ATTESTATION_TTL_SECONDS = 60 * 60;

/** The cookie's name, distinct from the session cookie's. */
const COOKIE_NAME = "r3:attested";

/** The attestation cookie, signed with the session secret so a visitor cannot forge one. */
function attestationCookie() {
	return createCookie(COOKIE_NAME, {
		path: "/",
		maxAge: ATTESTATION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure: getEnv("IS_PROD"),
		secrets: [getEnv("COOKIE_SESSION_SECRET")],
	});
}

/**
 * Records a redemption made now.
 *
 * @param now The redemption time.
 * @returns The `Set-Cookie` value to answer with.
 */
export function recordAttestation(now: Date = new Date()): Promise<string> {
	return attestationCookie().serialize(String(now.getTime()));
}

/**
 * Reports whether the request carries a redemption made within {@link ATTESTATION_TTL_SECONDS}.
 * The cookie's own expiry ends it in the browser; the signed time ends it here too.
 *
 * @param request The request, read for its cookies.
 * @param now The time to measure the attestation's age against.
 * @returns `true` while the attestation is fresh.
 */
export async function isAttested(request: Request, now: Date = new Date()): Promise<boolean> {
	let value = await attestationCookie().parse(request.headers.get("Cookie"));
	let attestedAt = Number(value);
	if (!value || !Number.isFinite(attestedAt)) return false;
	let age = now.getTime() - attestedAt;
	return age >= 0 && age < ATTESTATION_TTL_SECONDS * 1000;
}
