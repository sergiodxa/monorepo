/**
 * The platform router for `routes/web.ts`: the global middleware chain the bare platform
 * domain runs (trailing slash, logging, database, rendering, form data, method override,
 * Turnstile), and the public, signup, billing and dashboard routes, each imported on first use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { database } from "@sdxc/database-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import mailer from "@sdxc/mail/middleware";
import { previews } from "@sdxc/mail/previews";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { wellKnown } from "@sdxc/well-known/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { platformTenantForward } from "~/app/http/controllers/platform-tenant-forward";
import { models } from "~/app/http/middleware/models";
import { turnstileProvider } from "~/app/http/middleware/turnstile-verification";
import { assetResolver } from "~/app/initializers/assets";
import { openDatabase } from "~/app/initializers/database";
import { FALLBACK_LANGUAGE } from "~/app/initializers/i18n";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { MAIL_FROM, queue, transport } from "~/app/initializers/mail-transport";
import { turnstile } from "~/app/initializers/turnstile";
import { apiCatalogEntry } from "~/config/api-catalog";
import { PLATFORM_SECURITY_POLICY } from "~/config/security-policy";
import { securityTxtEntry } from "~/config/security-txt";
import routes from "~/routes/web";

/**
 * The platform Worker's router. `headRequests()` runs first so every later middleware
 * treats a `HEAD` probe as the `GET` behind it; the default handler forwards the platform
 * tenant's own allowlisted hosted pages and answers `404` for anything else.
 *
 * @example
 * return await webRouter.fetch(request);
 */
export const webRouter = createRouter({
	middleware: [
		headRequests(),
		trailingSlash(),
		log(logger),
		getClientIP(),
		trace(),
		asyncContext(),
		previews(mail, {
			locales: [FALLBACK_LANGUAGE],
			enabled: import.meta.env.DEV,
			stylesheets: () => assetResolver.getStylesheets("resources/views/hosted/document.tsx"),
		}),
		securityHeaders(PLATFORM_SECURITY_POLICY),
		wellKnown({ "security.txt": securityTxtEntry, "api-catalog": apiCatalogEntry }),
		database(openDatabase()),
		models(),
		mailer({ transport, from: MAIL_FROM, mail, queue }),
		render({ assets: assetResolver }),
		formData(),
		methodOverride(),
		turnstileProvider(turnstile),
	],
	defaultHandler: platformTenantForward,
});

webRouter.map(
	routes.index,
	lazy(() => import("~/app/http/controllers/index")),
);
webRouter.map(
	routes.health,
	lazy(() => import("~/app/http/controllers/health")),
);
webRouter.map(
	routes.cspReports,
	lazy(() => import("~/app/http/controllers/csp-reports").then((it) => it.cspReports)),
);
webRouter.map(
	routes.billing.checkout,
	lazy(() => import("~/app/http/controllers/billing/checkout")),
);
webRouter.map(
	routes.billing.checkoutReturn,
	lazy(() => import("~/app/http/controllers/billing/checkout-return")),
);
webRouter.map(
	routes.billing.portal,
	lazy(() => import("~/app/http/controllers/billing/portal")),
);
webRouter.map(
	routes.billing.webhook,
	lazy(() => import("~/app/http/controllers/billing/webhook")),
);

webRouter.map(
	routes.signup.show,
	lazy(() => import("~/app/http/controllers/signup/show").then((it) => it.signupShow)),
);
webRouter.map(
	routes.signup.submit,
	lazy(() => import("~/app/http/controllers/signup/show").then((it) => it.signupSubmit)),
);
webRouter.map(
	routes.signup.pending,
	lazy(() => import("~/app/http/controllers/signup/pending")),
);
webRouter.map(
	routes.signup.verify,
	lazy(() => import("~/app/http/controllers/signup/verify")),
);
webRouter.map(
	routes.signup.resend,
	lazy(() => import("~/app/http/controllers/signup/resend")),
);

webRouter.map(
	routes.dashboard.show,
	lazy(() => import("~/app/http/controllers/dashboard/show").then((it) => it.dashboardShow)),
);
webRouter.map(
	routes.dashboard.createTenant,
	lazy(() =>
		import("~/app/http/controllers/dashboard/show").then((it) => it.dashboardCreateTenant),
	),
);
webRouter.map(
	routes.dashboard.agentClients,
	lazy(() =>
		import("~/app/http/controllers/dashboard/agent-clients").then(
			(it) => it.dashboardAgentClientsShow,
		),
	),
);
webRouter.map(
	routes.dashboard.registerAgentClient,
	lazy(() =>
		import("~/app/http/controllers/dashboard/agent-clients").then(
			(it) => it.dashboardAgentClientsRegister,
		),
	),
);
webRouter.map(
	routes.dashboard.signOut,
	lazy(() => import("~/app/http/controllers/dashboard/sign-out").then((it) => it.dashboardSignOut)),
);
