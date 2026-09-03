/**
 * Publishes the Polar client the reporting job bills through, so a handler ingests
 * usage via `ctx.polar` and a test hands it a client that records instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@pkg/jobs-next";

import { PolarClient } from "@pkg/polar";
import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";

/** The Polar billing client, published as `ctx.polar`. */
export const Polar = createContextKey<PolarClient>();

/**
 * Publishes the Polar client for the job about to run.
 *
 * @returns The middleware installing it as `ctx.polar`.
 */
export function polar(): JobMiddleware<{
	key: typeof Polar;
	value: PolarClient;
	property: "polar";
}> {
	return async (ctx, next) => {
		ctx.set(Polar, new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN }), {
			property: "polar",
		});
		await next();
	};
}
