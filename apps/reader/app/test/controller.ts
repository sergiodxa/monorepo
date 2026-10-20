/**
 * Drives one controller through a real router, so a test exercises the middleware a
 * controller actually depends on — the async context its guard reads, the parsed form
 * data its action reads, the dictionary its copy comes from — while leaving out the s
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import featureFlags from "@sdxc/flags/middleware/router";
import { lazy } from "@sdxc/lazy-route";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";

import type { Viewer } from "~/app/http/middleware/auth";
import type { createWebRouter } from "~/app/initializers/router";

import i18n from "~/app/http/middleware/i18n";
import presentation from "~/app/http/middleware/presentation";
import { flags } from "~/app/initializers/flags";
import { documentRendering } from "~/app/test/rendering";
import { SECURITY_POLICY } from "~/config/security-policy";
import routes from "~/routes/web";

/**
 * The router a controller under test is mapped onto, typed as the app's own so a controller
 * written against the full context maps onto it. Its chain seeds the values a page reads in
 * place of the session, the sign-in and the log the production chain builds.
 */
export type AppRouter = ReturnType<typeof createWebRouter>;

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
export function createTestRouter(viewer: Viewer | null): AppRouter {
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
			securityHeaders(SECURITY_POLICY) as Middleware,
			/**
			 * The app's own renderer, so each frame on a page is resolved through the router the
			 * test dispatches against and a band of a page fetched in its own request is
			 * asserted on as part of the page.
			 */
			...documentRendering(),
		],
	}) as unknown as AppRouter;

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
	router: AppRouter,
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
