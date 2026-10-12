/**
 * The books fetch-router: the global middleware stack (async context, request logging and
 * tracing, campaign attribution, form data, cross-origin protection, billing, newsletter,
 * document assets, HTML rendering) and every route mapped onto its controller. The worker builds it per
 * request and the router tests build the same one over an in-memory platform and list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { Newsletter } from "@sdxc/newsletter";

import { assets } from "@sdxc/assets-middleware";
import { attribution } from "@sdxc/attribution/middleware";
import billing from "@sdxc/billing/middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import newsletter from "@sdxc/newsletter/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import { assetResolver } from "~/app/initializers/assets";
import { polar } from "~/app/initializers/billing";
import { attributionCookie } from "~/app/initializers/cookies";
import { logger } from "~/app/initializers/logger";
import { buttondown } from "~/app/initializers/newsletter";
import routes from "~/routes/web";

/**
 * Builds the books HTTP router. `headRequests()` leads the middleware chain so a `HEAD` probe
 * reads like its `GET` to later steps. Each route is mapped individually through `lazy()`,
 * since `router.map` throws on a nested route group, so a request imports only its controller.
 *
 * @param provider - The platform every route bills against, published as
 * `context.billing`; a test supplies an in-memory one.
 * @param list - The newsletter every form subscribes to, published as
 * `context.newsletter`; a test supplies an in-memory one.
 * @returns The configured router the worker forwards requests to.
 */
export function createWebRouter(provider: Billing = polar, list: Newsletter = buttondown) {
	let router = createRouter({
		middleware: [
			headRequests(),
			asyncContext(),
			log(logger),
			getClientIP(),
			trace(),

			/**
			 * Remembers the campaign a visitor landed from in a signed cookie, so the subscribe
			 * forms and the checkouts credit it as `ctx.attribution` however many pages later
			 * the visitor converts.
			 */
			attribution({ store: attributionCookie() }),
			formData(),

			/**
			 * The billing webhook is a cross-origin POST authenticated by its
			 * Standard-Webhooks signature, so it bypasses cross-origin protection: a
			 * `cop()` rejection here would silently drop every paid-order event.
			 */
			cop({ insecureBypassPatterns: ["/webhooks/polar"] }),

			billing({ provider }),
			newsletter({ provider: list }),

			/**
			 * Resolves the document's stylesheets and client entry once per request, as
			 * `ctx.assets`, which every page hands its document layout.
			 */
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
			}),
			render({ assets: assetResolver }),
		],
		defaultHandler,
	});

	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		routes.release,
		lazy(() => import("~/app/http/controllers/release")),
	);
	router.map(
		routes.healthcheck,
		lazy(() => import("~/app/http/controllers/healthcheck")),
	);
	router.map(
		routes.sample.index,
		lazy(() => import("~/app/http/controllers/sample").then((it) => it.index)),
	);
	router.map(
		routes.sample.action,
		lazy(() => import("~/app/http/controllers/sample").then((it) => it.action)),
	);
	router.map(
		routes.sampleDownload,
		lazy(() => import("~/app/http/controllers/sample-download").then((it) => it.sampleDownload)),
	);
	router.map(
		routes.upgrade.index,
		lazy(() => import("~/app/http/controllers/upgrade").then((it) => it.index)),
	);
	router.map(
		routes.upgrade.action,
		lazy(() => import("~/app/http/controllers/upgrade").then((it) => it.action)),
	);
	router.map(
		routes.api.subscribe,
		lazy(() => import("~/app/http/controllers/subscribe")),
	);
	router.map(
		routes.api.checkout,
		lazy(() => import("~/app/http/controllers/checkout")),
	);
	router.map(
		routes.webhooks.polar,
		lazy(() => import("~/app/http/controllers/webhooks/polar")),
	);

	return router;
}
