/**
 * Assembles the platform-domain HTTP router: the shared middleware stack (async
 * context, HTML rendering, signed session, cross-origin protection, form/method
 * parsing) and every dashboard, auth, marketing, and webhook route mapping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import { headRequests } from "@pkg/http/middleware/head-requests";
import { notFound } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";

import polarWebhook from "~/app/http/controllers/api/webhooks/polar";
import * as auth from "~/app/http/controllers/auth";
import billing from "~/app/http/controllers/dashboard/billing";
import blogs, { domain, restore, usage } from "~/app/http/controllers/dashboard/blogs";
import dashboardIndex from "~/app/http/controllers/dashboard/index";
import health from "~/app/http/controllers/health";
import index from "~/app/http/controllers/index";
import renderMiddleware from "~/app/http/middleware/render";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import routes from "~/routes/web";

/**
 * Builds the platform dashboard + marketing router. The worker entry only reaches
 * this on the platform domain; each route group is mapped separately (nested
 * route-map keys throw at runtime).
 *
 * @returns A configured `fetch-router` whose `.fetch(request)` handles every
 *   platform-domain route, falling back to a 404 for unmatched paths.
 */
export function createDashboardRouter() {
	/**
	 * Runs `headRequests()` first so everything after it — the session,
	 * cross-origin protection, the dashboard guards — sees a plain `GET` and
	 * treats a `HEAD` probe exactly as it would the request behind it.
	 */
	let middleware: Middleware[] = [
		headRequests(),
		asyncContext(),
		renderMiddleware as Middleware,
		createSessionMiddleware(env.COOKIE_SESSION_SECRET, true),
		/**
		 * Rejects unsafe cross-origin/same-site requests; tenant subdomains are
		 * same-site. Exempts the Polar webhook path, which authenticates itself
		 * via its own request signature.
		 */
		cop({ insecureBypassPatterns: ["/api/webhooks/"] }),
		formData() as Middleware,
		methodOverride(),
	];

	let router = createRouter({
		middleware,
		defaultHandler: () => notFound("Not found"),
	});

	router.map(routes.index, index);
	router.map(routes.health, health);

	router.map(routes.auth.login, auth.login);
	router.map(routes.auth.callback, auth.callback);
	router.map(routes.auth.logout, auth.logout);

	router.map(routes.api.webhooks.polar, polarWebhook);

	router.map(routes.dashboard.index, dashboardIndex);
	router.map(routes.dashboard.billing, billing);
	router.map(routes.dashboard.blogs, blogs);
	router.map(routes.dashboard.blogDomain, domain);
	router.map(routes.dashboard.blogUsage, usage);
	router.map(routes.dashboard.blogRestore, restore);

	return router;
}
