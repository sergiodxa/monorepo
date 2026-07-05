import type { Middleware } from "remix/fetch-router";

import { notFound } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

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
 */
export function createDashboardRouter() {
	let middleware: Middleware[] = [
		asyncContext(),
		renderMiddleware as Middleware,
		createSessionMiddleware(env.COOKIE_SESSION_SECRET, true),
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
	router.map(routes.auth.logout, auth.logout_);

	router.map(routes.api.webhooks.polar, polarWebhook);

	router.map(routes.dashboard.index, dashboardIndex);
	router.map(routes.dashboard.billing, billing);
	router.map(routes.dashboard.blogs, blogs);
	router.map(routes.dashboard.blogDomain, domain);
	router.map(routes.dashboard.blogUsage, usage);
	router.map(routes.dashboard.blogRestore, restore);

	return router;
}
