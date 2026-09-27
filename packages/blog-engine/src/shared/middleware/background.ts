/**
 * Middleware that publishes the host's background-work hook on the request context, so a
 * controller hands work that outlives the response (a hub ping) to `ctx.waitUntil` and a
 * Worker host keeps the invocation alive until it settles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

/** Hands a promise to the host so it may finish after the response is sent. */
export type WaitUntil = (promise: Promise<unknown>) => void;

/** Where a request's background hook lives on the context, installed as `ctx.waitUntil`. */
export const Background: { defaultValue?: WaitUntil } = createContextKey<WaitUntil>();

/**
 * A host with no hook (a Durable Object, whose pending promises run while it stays
 * alive) still gets a callable one, which observes rejections so none goes unhandled.
 */
function detach(promise: Promise<unknown>): void {
	promise.catch(() => undefined);
}

/**
 * Publishes the host's `waitUntil`, or a detaching fallback when the host passed none.
 *
 * @param waitUntil - The host's hook, e.g. Cloudflare's `ctx.waitUntil`.
 * @returns The middleware, for the router's chain.
 * @example createRouter({ middleware: [background(config.waitUntil)] });
 */
export function background(waitUntil: WaitUntil | undefined): Middleware {
	let hook = waitUntil ?? detach;
	return (ctx, next) => {
		ctx.set(Background, hook, { property: "waitUntil" });
		return next();
	};
}

declare module "remix/router" {
	interface RequestContext {
		/** Keeps background work alive past the response, published by `background()`. */
		waitUntil: WaitUntil;
	}
}
