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

import type { Middleware, RequestContext } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { headRequests } from "@pkg/http/middleware/head-requests";
import { asyncContext } from "remix/async-context-middleware";
import { cop } from "remix/cop-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { renderWith } from "remix/render-middleware";
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
import logger from "~/app/http/middleware/logger";
import routes from "~/routes/web";

/**
 * Builds the books HTTP router with its global middleware, route mappings, and the
 * HTML 404 fallback handler.
 *
 * @returns The configured router the worker forwards requests to.
 */
export default function application() {
	let globalMiddleware: Middleware[] = [
		// First, so everything after it — cross-origin protection included — sees a plain
		// `GET` and treats a `HEAD` probe exactly as it would the page request behind it.
		headRequests(),
		asyncContext(),
		logger,
		formData() as Middleware,

		/**
		 * The Polar webhook is a cross-origin POST authenticated by its Standard-Webhooks
		 * signature, not by an origin header, so it has to bypass cross-origin protection.
		 * A `cop()` rejection here would read as an ordinary 403 in the logs while
		 * silently dropping paid-order events, which is why the bypass has its own test.
		 */
		cop({ insecureBypassPatterns: ["/webhooks/polar"] }),

		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({
		middleware: globalMiddleware,
		defaultHandler,
	});

	/* Mapped one leaf at a time: handing `router.map` a nested route map throws, so a
	route group is spread rather than passed whole. */
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
 * Creates the request-scoped renderer controllers reach through `ctx.render`. The site
 * renders no frames — it ships no client JavaScript — so the renderer streams the node
 * and sets the content type, with no frame resolver to install.
 */
function createHtmlRenderer(_ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(renderToStream(node), { ...init, headers });
	};
}
