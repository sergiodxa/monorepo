/**
 * Turns the Turnstile outcome `turnstileVerification` published into a pass/refuse decision
 * for one screen's failure policy: sign-up refuses any failure, while sign-in, reset and magic
 * link let an unreachable Turnstile through, so a vendor outage never stops sign-in everywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CaptchaOutcome } from "@sdxc/captcha/middleware";
import type { RequestContext } from "remix/router";

import { isFailure } from "@sdxc/result";
import { SecurityHeadersKey } from "@sdxc/security-headers/middleware";

import type { AttackSignalEnv } from "~/app/lib/attack-signals";

import { recordAttackSignal } from "~/app/lib/attack-signals";

/** Where a refused challenge records the tenant's own attack signal, and who it belongs to. */
export interface TurnstileAttackSignal {
	env: AttackSignalEnv;
	tenantId: string;
	country?: string;
}

/**
 * Records a refused challenge as the tenant's attack signal, its reason the failure's
 * provider-neutral code (`missing-token`, `rejected`, `expired`, …).
 */
function recordRefusal(attackSignal: TurnstileAttackSignal | undefined, reason: string): void {
	if (!attackSignal) return;

	recordAttackSignal(attackSignal.env, {
		tenantId: attackSignal.tenantId,
		surface: "credential",
		outcome: "refused-turnstile",
		reason,
		country: attackSignal.country,
	});
}

/**
 * Applies sign-up's unconditional, closed policy: a missing token, a refused one, and an
 * unreachable Turnstile all refuse the submission alike.
 *
 * @param outcome - The request's `ctx.captcha`.
 * @param attackSignal - Where to record a refusal; omitted, nothing is recorded.
 * @returns Whether the submission may proceed.
 * @example
 * let passed = passesUnconditionalTurnstileChallenge(ctx.captcha, { env, tenantId });
 */
export function passesUnconditionalTurnstileChallenge(
	outcome: CaptchaOutcome,
	attackSignal?: TurnstileAttackSignal,
): boolean {
	if (!isFailure(outcome)) return true;

	recordRefusal(attackSignal, outcome.error.code);
	return false;
}

/**
 * Applies the open policy of a screen that already decided to challenge: a missing token or
 * one Turnstile refuses stops the submission, while an unreachable Turnstile lets it through
 * unrecorded, since that path is not itself a refusal.
 *
 * @param outcome - The request's `ctx.captcha`.
 * @param attackSignal - Where to record a refusal; omitted, nothing is recorded.
 * @returns Whether the submission may proceed.
 * @example
 * let passed = passesConditionalTurnstileChallenge(ctx.captcha, { env, tenantId });
 */
export function passesConditionalTurnstileChallenge(
	outcome: CaptchaOutcome,
	attackSignal?: TurnstileAttackSignal,
): boolean {
	if (!isFailure(outcome) || outcome.error.code === "unavailable") return true;

	recordRefusal(attackSignal, outcome.error.code);
	return false;
}

/**
 * The response's CSP nonce for the widget's loader script, which the policy allows by nonce;
 * absent on a router without `securityHeaders()`, where no policy restricts scripts.
 *
 * @param ctx - The request context.
 * @returns The nonce, or `undefined` when no security headers are installed.
 */
export function turnstileNonce(ctx: RequestContext): string | undefined {
	return ctx.has(SecurityHeadersKey) ? ctx.get(SecurityHeadersKey)?.nonce : undefined;
}
