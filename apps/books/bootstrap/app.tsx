/**
 * Application bootstrap that assembles the books fetch-router. It registers the
 * global middleware stack (async context, request logging, form data, cross-origin
 * protection, HTML rendering), maps the funnel's routes onto their controllers, and
 * wires the request-scoped renderer. It exists as the composition root shared by the
 * worker and by the router-level tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { Middleware, RequestContext } from "remix/router";
import type { RemixNode } from "remix/ui";

import billing from "@sdxc/billing/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import checkout from "~/app/http/controllers/checkout";
import defaultHandler from "~/app/http/controllers/default-handler";
import healthcheck from "~/app/http/controllers/healthcheck";
import home from "~/app/http/controllers/home";
import release from "~/app/http/controllers/release";
import * as sample from "~/app/http/controllers/sample";
import subscribe from "~/app/http/controllers/subscribe";
import * as upgrade from "~/app/http/controllers/upgrade";
import polarWebhook from "~/app/http/controllers/webhooks/polar";
import { polar } from "~/app/lib/billing";
import routes from "~/routes/web";

import { logger } from "./logger";

/**
 * Builds the books HTTP router. `headRequests()` leads the middleware chain
 * so a `HEAD` probe reads like its `GET` to later steps, and each route is
 * mapped individually since `router.map` throws on a nested route group.
 *
 * @param provider - The platform every route bills against, published as
 * `context.billing`; a test supplies an in-memory one.
 * @returns The configured router the worker forwards requests to.
 */
export default function application(provider: Billing = polar) {
	let globalMiddleware: Middleware[] = [
		headRequests(),
		asyncContext(),
		log(logger) as Middleware,
		formData() as Middleware,

		/**
		 * The billing webhook is a cross-origin POST authenticated by its
		 * Standard-Webhooks signature, so it bypasses cross-origin protection: a
		 * `cop()` rejection here would silently drop every paid-order event.
		 */
		cop({ insecureBypassPatterns: ["/webhooks/polar"] }),

		billing({ provider }),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({
		middleware: globalMiddleware,
		defaultHandler,
	});

	router.map(routes.home, home);
	router.map(routes.release, release);
	router.map(routes.healthcheck, healthcheck);
	router.map(routes.sample.index, sample.index);
	router.map(routes.sample.action, sample.action);
	router.map(routes.upgrade.index, upgrade.index);
	router.map(routes.upgrade.action, upgrade.action);
	router.map(routes.api.subscribe, subscribe);
	router.map(routes.api.checkout, checkout);
	router.map(routes.webhooks.polar, polarWebhook);

	return router;
}

/**
 * Creates the request-scoped renderer reached through `ctx.render` for a
 * fully server-rendered site. `createHtmlResponse` prepends `<!DOCTYPE html>`
 * to the stream's first chunk, the only point JSX rendering leaves to add it.
 */
function createHtmlRenderer(_ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return createHtmlResponse(renderToStream(node), { ...init, headers });
	};
}
