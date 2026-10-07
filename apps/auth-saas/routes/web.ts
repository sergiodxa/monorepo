/**
 * The centralized, type-safe route table for the platform Worker. Declares every URL
 * so controllers, middleware, and views share a single source of truth for paths and
 * can build hrefs via `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, post, route } from "remix/routes";

/**
 * The application route map. Each leaf is a typed route with `.href(params)` for
 * building URLs and is used as the key when mapping controllers in `bootstrap/app.ts`.
 *
 * @example
 * routes.index.href();
 */
export default route({
	index: get("/"),
	health: get("/health"),
	cspReports: post("/reports/csp"),

	/**
	 * Per-tenant subscriptions (ADR-018). `checkout` and `portal` answer the
	 * tenant owner's dashboard session alone; a UI posts to them and is
	 * redirected through `checkoutReturn`.
	 */
	billing: {
		checkout: post("/billing/tenants/:tenantId/checkout"),
		checkoutReturn: get("/billing/checkout/return"),
		portal: post("/billing/tenants/:tenantId/portal"),
		webhook: post("/webhooks/billing"),
	},

	/**
	 * Self-serve platform onboarding: claims an email and an organization name,
	 * verifies the email, and provisions a brand-new tenant owned by the
	 * signed-up subject.
	 */
	signup: {
		show: get("/signup"),
		submit: post("/signup"),
		pending: get("/signup/pending"),
		verify: get("/signup/verify"),
		resend: post("/signup/resend"),
	},

	/**
	 * The platform's own administrative dashboard: the first UI consumer of the
	 * Management API. Every page requires a valid platform session.
	 */
	dashboard: {
		show: get("/dashboard"),
		createTenant: post("/dashboard/tenants"),
		agentClients: get("/dashboard/tenants/:tenantId/agent-clients"),
		registerAgentClient: post("/dashboard/tenants/:tenantId/agent-clients"),
		signOut: post("/dashboard/sign-out"),
	},
});
