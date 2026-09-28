/**
 * Verifies the Turnstile token a hosted or platform form submitted, publishing the outcome
 * as `ctx.captcha` for the handler to apply its own screen's policy to: sign-up refuses any
 * failure, while sign-in, reset and magic link let an unreachable Turnstile through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Captcha } from "@sdxc/captcha";
import type { Middleware } from "remix/router";

import { captcha } from "@sdxc/captcha/middleware";
import { getClientIP } from "@sdxc/get-client-ip";

/**
 * Every failure, `unavailable` included, continues to the handler, which re-renders its form
 * with a localized message rather than a bare 403 and lets an unchallenged sign-in through
 * without a token. Install it after the rate limits, so a refused request never spends a
 * verification.
 *
 * @param provider - The platform's `Turnstile`, or a `MemoryCaptcha` in tests.
 * @returns The middleware, for a submitting route's own `middleware` array.
 * @example
 * router.map(routes.hostedSignUpSubmit, {
 * 	middleware: [credentialRateLimit, turnstileVerification(turnstile)],
 * 	handler: signUpSubmit,
 * });
 */
export function turnstileVerification(provider: Captcha): Middleware {
	return captcha(provider, {
		remoteIp: (request) => getClientIP(request),
		onFailure: () => null,
	}) as Middleware;
}
