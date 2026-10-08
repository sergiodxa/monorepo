/**
 * Whether an address has spent enough of the interactive-credential budget to
 * warrant a Turnstile challenge on `/u/sign-in`, `/u/reset` and `/u/magic-link`. The
 * `CloudflareAdapter` that budget itself runs on never reports how much of it
 * is left — Cloudflare's own rate limiter binding answers only allow or deny
 * — so this is a second, purpose-built counter: a `KVAdapter`, which counts
 * for itself and so does report `remaining`, tracking the same address over
 * the same window as the credential class. It answers one question, whether
 * that address has crossed the halfway mark, and never gates a request on
 * its own; the real budget behind `interactiveCredentialRateLimit` keeps
 * running through `CloudflareAdapter` unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimitKVNamespace } from "@sdxc/rate-limit";
import type { Middleware } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { addressKey, KVAdapter } from "@sdxc/rate-limit";
import { createContextKey } from "remix/router";

import { CREDENTIAL_LIMIT, CREDENTIAL_WINDOW } from "~/app/http/middleware/tenant-rate-limit";

export const TurnstileChallengeContext = createContextKey<boolean>();

declare module "remix/router" {
	interface RequestContext {
		/**
		 * Whether this request's connecting address has crossed half its
		 * shared credential budget, present on every route `turnstileChallenge`
		 * guards. Read this rather than a form field a submission claims,
		 * since a submission can always omit a self-report.
		 */
		turnstileChallenge: boolean;
	}
}

/** Namespaces this counter's entries apart from the credential class's own, even though both share one KV-adapter shape. */
const CHALLENGE_PREFIX = "turnstile-challenge";

/** An address is challenged once half or less of the shared budget remains. */
const CHALLENGE_THRESHOLD = Math.floor(CREDENTIAL_LIMIT / 2);

/**
 * Answers whether the request's connecting address should see a Turnstile
 * challenge right now, spending one unit of this counter's own budget to
 * reach the answer — the same minimum every `Adapter` call spends, so a page
 * load costs this counter one unit rather than the real credential budget.
 *
 * @param kv - The `TURNSTILE_CHALLENGE_KV` namespace.
 * @param request - The incoming request, read only for its connecting address.
 * @returns Whether the address has spent more than half its shared window's budget.
 * @example
 * let challenge = await shouldChallengeWithTurnstile(env.TURNSTILE_CHALLENGE_KV, ctx.request);
 */
export async function shouldChallengeWithTurnstile(
	kv: RateLimitKVNamespace,
	request: Request,
): Promise<boolean> {
	let adapter = new KVAdapter(kv, {
		limit: CREDENTIAL_LIMIT,
		window: CREDENTIAL_WINDOW,
		prefix: CHALLENGE_PREFIX,
	});

	let decision = await adapter.consume(addressKey(getClientIP(request)));

	return (
		decision.status === "success" &&
		decision.data.remaining !== null &&
		decision.data.remaining <= CHALLENGE_THRESHOLD
	);
}

/**
 * Answers {@link shouldChallengeWithTurnstile} once per request and exposes
 * it on the context as `turnstileChallenge`, for `/u/sign-in`, `/u/reset` and
 * `/u/magic-link` to share one trigger the same way they share the real
 * credential budget.
 * Never refuses a request itself — a KV outage answers `false`, so a
 * verification the caller cannot presently show stays off rather than
 * blocking the screen it would have guarded.
 *
 * @param kv - The `TURNSTILE_CHALLENGE_KV` namespace.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.hostedSignInShow, {
 * 	middleware: [turnstileChallenge(env.TURNSTILE_CHALLENGE_KV)],
 * 	handler: signInShow,
 * });
 */
export function turnstileChallenge(kv: RateLimitKVNamespace): Middleware {
	return async (context, next) => {
		let challenge = await shouldChallengeWithTurnstile(kv, context.request);
		context.set(TurnstileChallengeContext, challenge, { property: "turnstileChallenge" });
		return next();
	};
}
