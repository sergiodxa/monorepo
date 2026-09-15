/**
 * Drives one controller through a real router, so a test exercises the middleware a
 * controller actually depends on — the async context its guard reads, the parsed form
 * data its action reads, the dictionary its copy comes from — while leaving out the
 * session and the provider, which have nothing to do with what a page renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware, Router } from "remix/router";
import type { RemixNode } from "remix/ui";

import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";

/** The origin every test request is made against. */
export const ORIGIN = "https://reader.test";

/** The reader a signed-in test request is made as. */
export const VIEWER: Viewer = {
	id: "01J0READER0000000000000000",
	name: "Ada Lovelace",
	email: "ada@example.com",
	avatar: "",
};

/**
 * Renders through `renderToString`, which is enough for pages that stream no frames, and
 * gives a test one string to assert against rather than a stream to drain.
 */
export function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(await renderToString(node), { ...init, headers });
	};
}

/**
 * Sets the `Auth` context state directly, standing in for the session-backed `auth`
 * middleware, whose own job is turning stored tokens into this value.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
export function seedAuth(viewer: Viewer | null): Middleware {
	return (ctx, next) => {
		if (viewer) ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		else ctx.set(Auth, { ok: false });
		return next();
	};
}

/**
 * A router carrying the middleware a controller reads from, with nothing mapped onto it
 * yet. Cross-origin protection is left out: it guards the app rather than shaping any
 * page, and including it would make every test request carry an origin to satisfy it.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @example let router = createTestRouter(VIEWER); router.map(routes.reading, reading);
 */
export function createTestRouter(viewer: Viewer | null): Router {
	return createRouter({
		middleware: [
			asyncContext(),
			formData() as Middleware,
			methodOverride(),
			seedAuth(viewer),
			i18n,
			renderWith(createTestRenderer) as Middleware,
		],
	});
}

/**
 * Requests `path` through `router`, posting `body` as a form when one is given.
 *
 * @param router - The router to dispatch through.
 * @param path - A path on {@link ORIGIN}.
 * @param body - Form fields to post; omit for a `GET`.
 * @example await fetchRoute(router, routes.items.read.href({ itemId }), { read: "true" });
 */
export function fetchRoute(
	router: Router,
	path: string,
	body?: Record<string, string>,
): Promise<Response> {
	if (!body) return router.fetch(new Request(new URL(path, ORIGIN)));

	return router.fetch(
		new Request(new URL(path, ORIGIN), {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(body),
		}),
	);
}
