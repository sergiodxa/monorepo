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
import type { Middleware, RequestContext, Router } from "remix/router";
import type { RemixNode } from "remix/ui";

import featureFlags from "@sdxc/flags/middleware/router";
import { lazy } from "@sdxc/lazy-route";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import presentation from "~/app/http/middleware/presentation";
import securityHeaders from "~/app/http/middleware/security-headers";
import { resolveFrame } from "~/app/http/render";
import { flags } from "~/app/lib/flags";
import routes from "~/routes/web";

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
 * Renders the way the app does, and resolves each frame on the page through the router the
 * test is dispatching against, so a band of a page that arrives in its own request is
 * asserted on as part of the page rather than missing from it.
 *
 * The stream is drained before the response is handed back, which gives a test one string
 * to assert against rather than a stream to read.
 *
 * @param ctx - The request being answered, for the router its frames are fetched through.
 */
export function createTestRenderer(ctx: RequestContext): Renderer<RemixNode> {
	return async (node, init) => {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, ctx.i18next, src, target, context);
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return new Response(await new Response(stream).text(), { ...init, headers });
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
 * The sidebar's feed band is mapped here rather than by each test: every signed-in page
 * wears the chrome, and the band is a frame the chrome fetches, so a router without it
 * answers every page with a sidebar that failed to load.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @example let router = createTestRouter(VIEWER); router.map(routes.reading, reading);
 */
export function createTestRouter(viewer: Viewer | null): Router {
	let router = createRouter({
		middleware: [
			asyncContext(),
			formData() as Middleware,
			methodOverride(),
			seedAuth(viewer),
			/**
			 * The app's own flags, resolving against the definitions it ships. A page under
			 * test then takes the branch it will take in production, rather than whichever one
			 * a missing client happens to produce.
			 */
			featureFlags(flags, { context: () => ({ targetingKey: viewer?.id }) }) as Middleware,
			i18n,
			/**
			 * A page under test is painted the way a reader's request paints it, so a controller
			 * reading `ctx.presentation` reads the same answer here that it reads in production.
			 */
			presentation,
			/**
			 * Every page is served under the app's own policy here too, so a test that renders a
			 * document is also a test of what that document is allowed to load.
			 */
			securityHeaders,
			renderWith(createTestRenderer) as Middleware,
		],
	});

	router.map(
		routes.sidebar.feeds,
		lazy(() => import("~/app/http/controllers/sidebar")),
	);

	return router;
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
