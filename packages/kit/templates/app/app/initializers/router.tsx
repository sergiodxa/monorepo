/**
 * The router: the middleware every request runs through, and every route in `routes/web.ts`
 * and `routes/api.ts` mapped onto its controller through `lazy()`, so a request imports only
 * the controller it reaches. `sdxc make controller` maps each new controller here.
 */

import type { RouterContext } from "remix/router";

import { models } from "@sdxc/data-model/router";
import { database } from "@sdxc/database-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import mailer from "@sdxc/mail/middleware";
import { previews } from "@sdxc/mail/previews";
import { noWWW } from "@sdxc/no-www-middleware";
import { addressKey, CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { wellKnown } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import serverTiming from "~/app/http/middleware/server-timing";
import { assetResolver } from "~/app/initializers/assets";
import { openDatabase } from "~/app/initializers/database";
import { SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { queue, transport } from "~/app/initializers/mail-transport";
import registry from "~/app/models";
import { MAIL_FROM } from "~/config/constants";
import problems from "~/config/problems";
import { securityTxtEntry } from "~/config/security-txt";
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
 * While developing, `/_emails` previews every mapped email in every supported language.
 */
export function createWebRouter() {
	let router = createRouter({
		middleware: [
			asyncContext(),
			log(logger),
			trace(),
			serverTiming(),
			noWWW(),
			trailingSlash(),
			wellKnown({ "security.txt": securityTxtEntry }),
			getClientIP(),
			userAgent(),
			rateLimit({
				adapter: new CloudflareAdapter(env.RATE_LIMITER, { limit: 100, window: "1 minute" }),
				prefix: "address",
				key: (ctx) => addressKey(ctx.ip),
				onLimit: () => problems.tooManyRequests(),
			}),
			database(openDatabase()),
			models(registry, (ctx) => ({ db: ctx.db })),
			previews(mail, {
				locales: SUPPORTED_LANGUAGES,
				enabled: import.meta.env.DEV,
				stylesheets: () => assetResolver.getStylesheets("resources/layouts/document.tsx"),
			}),
			mailer({ transport, from: MAIL_FROM, mail, queue }),
		],
	});

	router.map(
		webRoutes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		webRoutes.robots,
		lazy(() => import("~/app/http/controllers/robots")),
	);
	router.map(
		webRoutes.sitemap,
		lazy(() => import("~/app/http/controllers/sitemap")),
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
