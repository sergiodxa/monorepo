/**
 * Opens the funnel's connection to the newsletter. Built per call rather than once at
 * module scope, so the credential is read by the request that needs it: an isolate
 * missing it still boots and answers `/healthcheck`, and only the three routes that
 * subscribe or tag a reader fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { Buttondown } from "~/app/services/buttondown";

/**
 * Opens a connection to the newsletter this funnel subscribes readers to.
 *
 * @returns A client bound to this deployment's credentials.
 * @throws {Error} When `BUTTONDOWN_API_KEY` is unset.
 * @example
 * let result = await subscribe(buttondown(), payload, getClientIP(ctx.request));
 */
export function buttondown(): Buttondown {
	return new Buttondown({
		apiKey: env.BUTTONDOWN_API_KEY,
		apiVersion: env.BUTTONDOWN_API_VERSION,
	});
}
