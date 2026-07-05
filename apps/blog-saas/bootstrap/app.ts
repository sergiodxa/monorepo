import type { Middleware } from "remix/fetch-router";

import { notFound } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import polarWebhook from "~/app/http/controllers/api/webhooks/polar";
import * as auth from "~/app/http/controllers/auth";
import * as billing from "~/app/http/controllers/dashboard/billing";
import * as blogs from "~/app/http/controllers/dashboard/blogs";
import dashboardIndex from "~/app/http/controllers/dashboard/index";
import health from "~/app/http/controllers/health";
import index from "~/app/http/controllers/index";
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

	router.map(routes.auth.login, { actions: { index: auth.loginIndex, action: auth.loginStart } });
	router.map(routes.auth.callback, auth.callback);
	router.map(routes.auth.logout, { actions: { action: auth.logoutAction } });

	router.map(routes.api.webhooks.polar, polarWebhook);

	router.map(routes.dashboard.index, dashboardIndex);
	router.map(routes.dashboard.billing, {
		actions: { index: billing.index, action: billing.action_ },
	});
	router.map(routes.dashboard.blogs, {
		actions: {
			new: blogs.newBlog,
			create: blogs.create,
			show: blogs.show,
			edit: blogs.edit,
			update: blogs.update,
			destroy: blogs.destroy,
		},
	});
	router.map(routes.dashboard.blogDomain, {
		actions: { index: blogs.domainIndex, action: blogs.domainCreate },
	});
	router.map(routes.dashboard.blogUsage, blogs.usage);
	router.map(routes.dashboard.blogRestore, blogs.restore);

	return router;
}
