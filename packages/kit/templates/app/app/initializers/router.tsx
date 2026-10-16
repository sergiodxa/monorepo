/**
 * The router: the middleware every request runs through, and every route in `routes/web.ts`
 * and `routes/api.ts` mapped onto its controller through `lazy()`, so a request imports only
 * the controller it reaches. `sdxc make controller` maps each new controller here.
 */

import type { RouterContext } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { addressKey, CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import { logger } from "~/app/initializers/logger";
import problems from "~/config/problems";
import apiRoutes from "~/routes/api";
import webRoutes from "~/routes/web";

/** The context a controller sees once the router's middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Types `createAction` and `createController` with the context the router's chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/**
 * Builds the router the Worker forwards each request to. Its middleware is what pages and
 * endpoints both need, written inline so {@link AppContext} reads what each one publishes; a
 * controller adds its contract's chain, `app/http/middleware/page.ts` or `api.ts`, itself.
 */
export function createWebRouter() {
	let router = createRouter({
		middleware: [
			asyncContext(),
			log(logger),
			rateLimit({
				adapter: new CloudflareAdapter(env.RATE_LIMITER, { limit: 100, window: "1 minute" }),
				prefix: "address",
				key: (ctx) => addressKey(getClientIP(ctx.request)),
				onLimit: () => problems.tooManyRequests(),
			}),
		],
	});

	router.map(
		webRoutes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		webRoutes.notFound,
		lazy(() => import("~/app/http/controllers/not-found")),
	);

	router.map(
		apiRoutes.api.health,
		lazy(() => import("~/app/http/controllers/api/health")),
	);
	router.map(
		apiRoutes.api.openapi,
		lazy(() => import("~/app/http/controllers/api/openapi")),
	);
	router.map(
		apiRoutes.api.notFound,
		lazy(() => import("~/app/http/controllers/api/not-found")),
	);
	router.map(
		apiRoutes.mcp,
		lazy(() => import("~/app/http/controllers/mcp")),
	);

	return router;
}
