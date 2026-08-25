/**
 * Route table for the books funnel. Declares the four pages, the two form endpoints,
 * the checkout redirect, and the Polar webhook. Every pattern here is a published
 * contract — the checkout URL is linked from the pricing page, the webhook URL is
 * registered in Polar's dashboard — so patterns stay fixed once published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

/**
 * Registers the funnel's pages, form endpoints, checkout redirect, and webhook.
 */
export default route({
	home: get("/"),
	release: get("/release"),
	healthcheck: get("/healthcheck"),

	/** GET renders the email form; POST unlocks and renders the sample chapter. */
	sample: form("/sample"),

	/** GET renders the email form; POST resolves the customer and redirects to checkout. */
	upgrade: form("/upgrade"),

	api: route({
		subscribe: post("/api/subscribe"),

		/**
		 * This URL is linked from the pricing page and from the upgrade flow's
		 * redirects, and it is shareable, so it stays a GET that 302s to Polar.
		 */
		checkout: get("/api/checkout/:type"),
	}),

	webhooks: route({
		polar: post("/webhooks/polar"),
	}),
});
