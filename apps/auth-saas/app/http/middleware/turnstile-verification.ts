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
import { createContextKey } from "remix/router";

/** Where a router's Turnstile verifier lives on the context, installed as `ctx.turnstile`. */
export const TurnstileProvider = createContextKey<Captcha>();

declare module "remix/router" {
	interface RequestContext {
		/** The verifier every submitted Turnstile token is checked against. */
		turnstile: Captcha;
	}
}

/**
 * Publishes the verifier `turnstileVerification()` checks tokens against, so production
 * installs the platform's Turnstile and a test installs a `MemoryCaptcha`.
 *
 * @param provider - The platform's `Turnstile`, or a `MemoryCaptcha` in tests.
 * @returns The middleware installing it as `ctx.turnstile`, for a router's global chain.
 * @example
 * createRouter({ middleware: [formData(), turnstileProvider(turnstile)] });
 */
export function turnstileProvider(provider: Captcha): Middleware {
	return (ctx, next) => {
		ctx.set(TurnstileProvider, provider, { property: "turnstile" });
		return next();
	};
}

/**
 * Every failure, `unavailable` included, continues to the handler, which re-renders its form
 * with a localized message and lets an unchallenged sign-in through without a token.
 *
 * @returns The middleware publishing `ctx.captcha`, for a submitting action's own `middleware`.
 * @example
 * createAction(routes.hostedSignUpSubmit, { middleware: [turnstileVerification()], handler });
 */
export function turnstileVerification(): Middleware {
	return (ctx, next) => captcha(ctx.turnstile, { onFailure: () => null })(ctx, next);
}
