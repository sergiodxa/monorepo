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

import type { AttackSignalEnv } from "~/app/lib/attack-signals";

import { recordAttackSignal } from "~/app/lib/attack-signals";
import { verifyTurnstileToken } from "~/app/services/turnstile";

/** The form field Turnstile's own widget submits its response token under. */
const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

/** Reads the token a form submitted, or `null` when the widget never ran. */
function readTurnstileToken(formData: FormData): string | null {
	let token = formData.get(TURNSTILE_RESPONSE_FIELD);
	return typeof token === "string" && token.length > 0 ? token : null;
}

/** Where a refused challenge records the tenant's own attack signal, and who it belongs to. */
export interface TurnstileAttackSignal {
	env: AttackSignalEnv;
	tenantId: string;
	country?: string;
}

/**
 * Verifies a sign-up submission's token under sign-up's unconditional,
 * closed policy: a missing token, a refused one, and an unreachable
 * verification call all refuse the submission alike.
 *
 * @param secretKey - The platform's Turnstile secret key.
 * @param formData - The submitted form, read for its Turnstile token.
 * @param remoteIp - The connecting address, when known.
 * @param attackSignal - Where to record a refusal as the tenant's own attack
 * signal; omitted, nothing is recorded.
 * @returns Whether the submission may proceed.
 * @example
 * let passed = await passesUnconditionalTurnstileChallenge(env.TURNSTILE_SECRET_KEY, ctx.formData);
 */
export async function passesUnconditionalTurnstileChallenge(
	secretKey: string,
	formData: FormData,
	remoteIp?: string,
	attackSignal?: TurnstileAttackSignal,
): Promise<boolean> {
	let token = readTurnstileToken(formData);
	let verified = token === null ? null : await verifyTurnstileToken(secretKey, token, remoteIp);
	let passed = verified !== null && verified.ok;

	if (!passed && attackSignal) {
		recordAttackSignal(attackSignal.env, {
			tenantId: attackSignal.tenantId,
			surface: "credential",
			outcome: "refused-turnstile",
			reason: verified === null ? "no-token" : verified.ok ? undefined : verified.reason,
			country: attackSignal.country,
		});
	}

	return passed;
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
 * @param attackSignal - Where to record a refusal as the tenant's own attack
 * signal; omitted, nothing is recorded. Never recorded for a verification
 * call that could not complete, since that path is not itself a refusal.
 * @returns Whether the submission may proceed.
 * @example
 * let passed = await passesConditionalTurnstileChallenge(env.TURNSTILE_SECRET_KEY, ctx.formData);
 */
export async function passesConditionalTurnstileChallenge(
	secretKey: string,
	formData: FormData,
	remoteIp?: string,
	attackSignal?: TurnstileAttackSignal,
): Promise<boolean> {
	let token = readTurnstileToken(formData);

	if (!token) {
		if (attackSignal) {
			recordAttackSignal(attackSignal.env, {
				tenantId: attackSignal.tenantId,
				surface: "credential",
				outcome: "refused-turnstile",
				reason: "no-token",
				country: attackSignal.country,
			});
		}
		return false;
	}

	let verified = await verifyTurnstileToken(secretKey, token, remoteIp);
	let passed = verified.ok || verified.reason === "verification-unavailable";

	if (!passed && attackSignal) {
		recordAttackSignal(attackSignal.env, {
			tenantId: attackSignal.tenantId,
			surface: "credential",
			outcome: "refused-turnstile",
			reason: verified.ok ? undefined : verified.reason,
			country: attackSignal.country,
		});
	}

	return passed;
}
