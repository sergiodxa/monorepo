/**
 * Turns a submitted Turnstile token into a pass/refuse decision for one
 * hosted screen's own failure policy: sign-up refuses on any refusal, so a
 * vendor outage costs one visitor one retry rather than admitting an
 * unchallenged sign-up, while sign-in and reset let a verification call that
 * could not complete through instead, so that outage never stops every
 * tenant's users from signing in or resetting a password at once. A token
 * Turnstile itself rejects, or none presented at all, still refuses either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { verifyTurnstileToken } from "~/app/services/turnstile";

/** The form field Turnstile's own widget submits its response token under. */
const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

/** Reads the token a form submitted, or `null` when the widget never ran. */
function readTurnstileToken(formData: FormData): string | null {
	let token = formData.get(TURNSTILE_RESPONSE_FIELD);
	return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * Verifies a sign-up submission's token under sign-up's unconditional,
 * closed policy: a missing token, a refused one, and an unreachable
 * verification call all refuse the submission alike.
 *
 * @param secretKey - The platform's Turnstile secret key.
 * @param formData - The submitted form, read for its Turnstile token.
 * @param remoteIp - The connecting address, when known.
 * @returns Whether the submission may proceed.
 * @example
 * let passed = await passesUnconditionalTurnstileChallenge(env.TURNSTILE_SECRET_KEY, ctx.formData);
 */
export async function passesUnconditionalTurnstileChallenge(
	secretKey: string,
	formData: FormData,
	remoteIp?: string,
): Promise<boolean> {
	let token = readTurnstileToken(formData);
	if (!token) return false;

	let verified = await verifyTurnstileToken(secretKey, token, remoteIp);
	return verified.ok;
}

/**
 * Verifies a sign-in or reset submission's token, already known to have been
 * challenged: a missing token or one Turnstile refuses still stops the
 * submission, while a verification call that could not complete lets it
 * through, since that surface's policy is open to a vendor outage rather
 * than to skipping verification altogether.
 *
 * @param secretKey - The platform's Turnstile secret key.
 * @param formData - The submitted form, read for its Turnstile token.
 * @param remoteIp - The connecting address, when known.
 * @returns Whether the submission may proceed.
 * @example
 * let passed = await passesConditionalTurnstileChallenge(env.TURNSTILE_SECRET_KEY, ctx.formData);
 */
export async function passesConditionalTurnstileChallenge(
	secretKey: string,
	formData: FormData,
	remoteIp?: string,
): Promise<boolean> {
	let token = readTurnstileToken(formData);
	if (!token) return false;

	let verified = await verifyTurnstileToken(secretKey, token, remoteIp);
	return verified.ok || verified.reason === "verification-unavailable";
}
