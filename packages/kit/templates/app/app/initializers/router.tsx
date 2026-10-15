/**
 * The web router: the global middleware every request runs through, and every route in
 * `routes/web.ts` mapped onto its controller through `lazy()`, so a request imports only the
 * controller it reaches. `sdxc make controller` maps each new controller here.
 */

import type { RouterContext } from "remix/router";

import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { assets } from "sdxc/assets-middleware";
import { lazy } from "sdxc/lazy-route";
import { log } from "sdxc/logger/middleware";

import notFound from "~/app/http/controllers/not-found";
import { assetResolver } from "~/app/initializers/assets";
import { logger } from "~/app/initializers/logger";
import routes from "~/routes/web";

/** The context a controller sees once the global middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Types `createAction` and `createController` with the context the global chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/**
 * Builds the router the Worker forwards each request to. The middleware is written inline,
 * so the router's type carries what each one publishes and {@link AppContext} reads it.
 */
export function createWebRouter() {
	let router = createRouter({
		middleware: [
			asyncContext(),
			log(logger),
			formData(),
			cop(),
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
			}),
			render({ assets: assetResolver }),
		],
		defaultHandler: notFound,
	});

	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		routes.mcp,
		lazy(() =>
			import("~/app/initializers/mcp").then((it) => (ctx: AppContext) => it.default.fetch(ctx)),
		),
	);

	return router;
}
