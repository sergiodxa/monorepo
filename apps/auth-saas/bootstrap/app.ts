/**
 * Builds the platform dashboard's fetch-router: assembles the global middleware chain
 * (trailing-slash, logging, async context, rendering, form data, method override) and
 * maps every public, onboarding, dashboard, and tenant-scoped route to its controller
 * with the appropriate auth/subscription middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

import { headRequests } from "@sdxc/http/middleware/head-requests";
import logger from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";

import polarWebhook from "~/app/http/controllers/api/webhooks/polar";
import dashboardIndex from "~/app/http/controllers/dashboard/index";
import tenants from "~/app/http/controllers/dashboard/tenants";
import billing from "~/app/http/controllers/dashboard/tenants/billing";
import branding from "~/app/http/controllers/dashboard/tenants/branding";
import clients from "~/app/http/controllers/dashboard/tenants/clients";
import logoutUris from "~/app/http/controllers/dashboard/tenants/clients/logout-uris";
import redirectUris from "~/app/http/controllers/dashboard/tenants/clients/redirect-uris";
import secrets from "~/app/http/controllers/dashboard/tenants/clients/secrets";
import hostname from "~/app/http/controllers/dashboard/tenants/hostname";
import resources from "~/app/http/controllers/dashboard/tenants/resources";
import scopes from "~/app/http/controllers/dashboard/tenants/resources/scopes";
import users from "~/app/http/controllers/dashboard/tenants/users";
import userGrants from "~/app/http/controllers/dashboard/tenants/users/grants";
import userPasskeys from "~/app/http/controllers/dashboard/tenants/users/passkeys";
import userSessions from "~/app/http/controllers/dashboard/tenants/users/sessions";
import health from "~/app/http/controllers/health";
import index from "~/app/http/controllers/index";
import logout from "~/app/http/controllers/logout";
import notFound from "~/app/http/controllers/not-found";
import onboardingCallback from "~/app/http/controllers/onboarding/callback";
import onboardingIndex from "~/app/http/controllers/onboarding/index";
import render from "~/app/http/middleware/render";
import requireTenantRole from "~/app/http/middleware/require-tenant-role";
import session from "~/app/http/middleware/session";
import subscription from "~/app/http/middleware/subscription";
import tenantOwner from "~/app/http/middleware/tenant-owner";
import trailingSlash from "~/app/http/middleware/trailing-slash";
import routes from "~/routes/web";

/**
 * Kept as a non-tuple Middleware[] so the router context stays the base
 * RequestContext; `formData()` is cast to Middleware since its value is
 * surfaced via the global `formData` context augmentation.
 */
let globalMiddleware: Middleware[] = [
	/**
	 * Runs first so every later middleware — the session, the dashboard, and
	 * tenant guards — treats a `HEAD` probe as the `GET` request behind it.
	 */
	headRequests(),
	trailingSlash,
	logger,
	asyncContext(),
	render as Middleware,
	formData() as Middleware,
	methodOverride(),
];

/**
 * The platform dashboard router, configured with the global middleware chain and a
 * 404 default handler. Routes are registered onto it below; the worker entry calls
 * `router.fetch(request)` inside a container scope.
 *
 * @example
 * return await container.scope(() => router.fetch(request));
 */
export const router = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

/**
 * Tokenless cross-origin protection (Sec-Fetch-Site/Origin). Rejects same-site
 * requests too, so a tenant subdomain cannot forge requests to the platform
 * dashboard.
 */
let crossOrigin = cop();
/**
 * Each route group below repeats its full middleware chain on top of the
 * router-global middleware: a nested route-map key throws at runtime, and
 * middleware does not cascade across separate `map()` calls.
 */
let dashboard: Middleware[] = [session, crossOrigin];
/**
 * Mutations on tenant-scoped resources require owner or admin; `viewer`
 * members keep read access since `requireTenantRole` only gates non-safe
 * methods.
 */
let tenantScope: Middleware[] = [
	session,
	crossOrigin,
	tenantOwner,
	requireTenantRole("owner", "admin"),
	subscription,
];

router.map(routes.index, index);
router.map(routes.health, health);
router.map(routes.api.webhooks, { actions: { polar: polarWebhook } });
router.map(routes.onboarding, {
	actions: { index: onboardingIndex, callback: onboardingCallback },
});

router.map(routes.dashboard.index, {
	middleware: dashboard,
	handler: dashboardIndex as RequestHandler,
});
router.map(routes.logout, { middleware: dashboard, handler: logout as RequestHandler });
/** Enforces ownership inside the controller itself. */
router.map(routes.dashboard.tenants, { middleware: dashboard, actions: tenants });
/**
 * Composes the controller's own tenant middleware onto the dashboard chain;
 * spreading `{ ...ctrl, middleware }` would drop it and unset `context.tenant`.
 * Branding requires owner or admin.
 */
router.map(routes.dashboard.tenants.branding, {
	...branding,
	middleware: [...dashboard, tenantOwner, requireTenantRole("owner", "admin"), subscription],
});
/** Hostname changes require owner or admin. */
router.map(routes.dashboard.tenants.hostname, {
	...hostname,
	middleware: [...dashboard, tenantOwner, requireTenantRole("owner", "admin")],
});
/**
 * Billing is owner-only and leaves out the `subscription` gate so an owner on
 * a lapsed plan can still reach billing to fix it.
 */
router.map(routes.dashboard.tenants.billing, {
	...billing,
	middleware: [...dashboard, tenantOwner, requireTenantRole("owner")],
});

router.map(routes.dashboard.tenants.clients, { middleware: tenantScope, actions: clients });
router.map(routes.dashboard.tenants.clients["redirect-uris"], {
	middleware: tenantScope,
	actions: redirectUris,
});
router.map(routes.dashboard.tenants.clients["logout-uris"], {
	middleware: tenantScope,
	actions: logoutUris,
});
router.map(routes.dashboard.tenants.clients.secrets, {
	middleware: tenantScope,
	actions: secrets,
});

router.map(routes.dashboard.tenants.users, { middleware: tenantScope, actions: users });
router.map(routes.dashboard.tenants.users.sessions, {
	middleware: tenantScope,
	actions: userSessions,
});
router.map(routes.dashboard.tenants.users.passkeys, {
	middleware: tenantScope,
	actions: userPasskeys,
});
router.map(routes.dashboard.tenants.users.grants, {
	middleware: tenantScope,
	actions: userGrants,
});

router.map(routes.dashboard.tenants.resources, { middleware: tenantScope, actions: resources });
router.map(routes.dashboard.tenants.resources.scopes, {
	middleware: tenantScope,
	actions: scopes,
});
