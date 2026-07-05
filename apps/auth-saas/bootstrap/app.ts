import type { Middleware, RequestHandler } from "remix/fetch-router";

import { asyncContext } from "remix/async-context-middleware";
import { cop } from "remix/cop-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

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
import logger from "~/app/http/middleware/logger";
import render from "~/app/http/middleware/render";
import requireTenantRole from "~/app/http/middleware/require-tenant-role";
import session from "~/app/http/middleware/session";
import subscription from "~/app/http/middleware/subscription";
import tenantOwner from "~/app/http/middleware/tenant-owner";
import trailingSlash from "~/app/http/middleware/trailing-slash";
import routes from "~/routes/web";

// Typed as a non-tuple Middleware[] so the router context stays the base
// RequestContext (with its global augmentations) rather than a middleware-branded
// context; the mapped controllers are typed against that same default context.
// `formData()` is cast to the base Middleware to drop its context-transform brand;
// the value it provides is surfaced via the global `formData` context augmentation
// (see config/router-context.d.ts), not the transform.
let globalMiddleware: Middleware[] = [
	trailingSlash,
	logger,
	asyncContext(),
	render as Middleware,
	formData() as Middleware,
	methodOverride(),
];

export const router = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

// The current fetch-router requires one map() per route group (nested route-map
// keys in a controller throw at runtime). Middleware does not cascade across
// separate map() calls, so each group lists its full chain on top of the
// router-global middleware.
// Tokenless cross-origin protection (Sec-Fetch-Site/Origin). Rejects same-site too,
// so a tenant subdomain cannot forge requests to the platform dashboard.
let crossOrigin = cop();
let dashboard: Middleware[] = [session, crossOrigin];
// Mutations on tenant-scoped resources require owner or admin; `viewer` members keep
// read access (requireTenantRole only gates non-safe methods).
let tenantScope: Middleware[] = [
	session,
	crossOrigin,
	tenantOwner,
	requireTenantRole("owner", "admin"),
	subscription,
];

// Public + webhook + onboarding.
router.map(routes.index, index);
router.map(routes.health, health);
router.map(routes.api.webhooks, { actions: { polar: polarWebhook } });
router.map(routes.onboarding, {
	actions: { index: onboardingIndex, callback: onboardingCallback },
});

// Dashboard shell + tenant list/detail (ownership enforced inside the controllers).
router.map(routes.dashboard.index, {
	middleware: dashboard,
	handler: dashboardIndex as RequestHandler,
});
router.map(routes.logout, { middleware: dashboard, handler: logout as RequestHandler });
router.map(routes.dashboard.tenants, { middleware: dashboard, actions: tenants });
// These compose the controller's own tenant middleware onto the dashboard chain
// (spreading `{ ...ctrl, middleware }` would otherwise drop it, unsetting
// `context.tenant`). Branding/hostname are owner+admin; billing is owner-only and
// intentionally skips the `subscription` gate so a lapsed plan can still be fixed.
router.map(routes.dashboard.tenants.branding, {
	...branding,
	middleware: [...dashboard, tenantOwner, requireTenantRole("owner", "admin"), subscription],
});
router.map(routes.dashboard.tenants.hostname, {
	...hostname,
	middleware: [...dashboard, tenantOwner, requireTenantRole("owner", "admin")],
});
router.map(routes.dashboard.tenants.billing, {
	...billing,
	middleware: [...dashboard, tenantOwner, requireTenantRole("owner")],
});

// Tenant-scoped management (owner + active subscription required).
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
