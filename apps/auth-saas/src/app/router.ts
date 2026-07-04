import type { Middleware, RequestHandler } from "remix/fetch-router";

import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import polarWebhook from "./controllers/api/webhooks/polar";
import dashboardIndex from "./controllers/dashboard/index";
import tenants from "./controllers/dashboard/tenants";
import billing from "./controllers/dashboard/tenants/billing";
import branding from "./controllers/dashboard/tenants/branding";
import clients from "./controllers/dashboard/tenants/clients";
import logoutUris from "./controllers/dashboard/tenants/clients/logout-uris";
import redirectUris from "./controllers/dashboard/tenants/clients/redirect-uris";
import secrets from "./controllers/dashboard/tenants/clients/secrets";
import hostname from "./controllers/dashboard/tenants/hostname";
import resources from "./controllers/dashboard/tenants/resources";
import scopes from "./controllers/dashboard/tenants/resources/scopes";
import users from "./controllers/dashboard/tenants/users";
import userGrants from "./controllers/dashboard/tenants/users/grants";
import userPasskeys from "./controllers/dashboard/tenants/users/passkeys";
import userSessions from "./controllers/dashboard/tenants/users/sessions";
import health from "./controllers/health";
import index from "./controllers/index";
import notFound from "./controllers/not-found";
import onboardingCallback from "./controllers/onboarding/callback";
import onboardingIndex from "./controllers/onboarding/index";
import csrf from "./middleware/csrf";
import database from "./middleware/db";
import logger from "./middleware/logger";
import session from "./middleware/session";
import subscription from "./middleware/subscription";
import tenantOwner from "./middleware/tenant-owner";
import trailingSlash from "./middleware/trailing-slash";
import routes from "./routes";

// Typed as a non-tuple Middleware[] so the router context stays the base
// RequestContext (with its global augmentations) rather than a middleware-branded
// context; the mapped controllers are typed against that same default context.
// `formData()` is cast to the base Middleware to drop its context-transform brand;
// the value it provides is surfaced via the global `formData` context augmentation
// (see src/router-context.d.ts), not the transform.
let globalMiddleware: Middleware[] = [
	trailingSlash,
	logger,
	database,
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
let dashboard: Middleware[] = [session, csrf];
let tenantScope: Middleware[] = [session, csrf, tenantOwner, subscription];

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
router.map(routes.dashboard.tenants, { middleware: dashboard, actions: tenants });
router.map(routes.dashboard.tenants.branding, { ...branding, middleware: dashboard });
router.map(routes.dashboard.tenants.hostname, { ...hostname, middleware: dashboard });
router.map(routes.dashboard.tenants.billing, { ...billing, middleware: dashboard });

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
