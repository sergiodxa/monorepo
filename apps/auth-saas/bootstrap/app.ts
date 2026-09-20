/**
 * Builds the platform Worker's fetch-router: assembles the global middleware chain
 * (trailing-slash, logging, async context, database, rendering, form data, method
 * override) and maps the public routes to their controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { headRequests } from "@sdxc/http/middleware/head-requests";
import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";

import billingCheckout from "~/app/http/controllers/billing/checkout";
import billingCheckoutReturn from "~/app/http/controllers/billing/checkout-return";
import billingPortal from "~/app/http/controllers/billing/portal";
import billingWebhook from "~/app/http/controllers/billing/webhook";
import health from "~/app/http/controllers/health";
import index from "~/app/http/controllers/index";
import notFound from "~/app/http/controllers/not-found";
import { database } from "~/app/http/middleware/database";
import render from "~/app/http/middleware/render";
import trailingSlash from "~/app/http/middleware/trailing-slash";
import { createDatabase } from "~/app/lib/database";
import routes from "~/routes/web";

import { logger } from "./logger";

/**
 * Kept as a non-tuple Middleware[] so the router context stays the base
 * RequestContext; `formData()` is cast to Middleware since its value is
 * surfaced via the global `formData` context augmentation.
 */
let globalMiddleware: Middleware[] = [
	/**
	 * Runs first so every later middleware treats a `HEAD` probe as the `GET`
	 * request behind it.
	 */
	headRequests(),
	trailingSlash,
	log(logger) as Middleware,
	asyncContext(),
	database(createDatabase),
	render as Middleware,
	formData() as Middleware,
	methodOverride(),
];

/**
 * The platform Worker's router, configured with the global middleware chain and a
 * 404 default handler. Routes are registered onto it below; the worker entry calls
 * `router.fetch(request)`.
 *
 * @example
 * return await router.fetch(request);
 */
export const router = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

router.map(routes.index, index);
router.map(routes.health, health);
router.map(routes.billing.checkout, billingCheckout);
router.map(routes.billing.checkoutReturn, billingCheckoutReturn);
router.map(routes.billing.portal, billingPortal);
router.map(routes.billing.webhook, billingWebhook);
