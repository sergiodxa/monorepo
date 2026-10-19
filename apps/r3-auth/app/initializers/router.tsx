/**
 * The authorization server's fetch-router: the global middleware chain every request passes
 * through, and every route mapped onto its controller through `lazy()`, so a cold isolate
 * imports only the controller a request reaches while the URL surface stays complete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { Transport } from "@sdxc/mail";
import type { Database as DataTable } from "remix/data-table";
import type { RouterContext } from "remix/router";

import { assets } from "@sdxc/assets-middleware";
import billing from "@sdxc/billing/middleware";
import { models } from "@sdxc/data-model/router";
import { database } from "@sdxc/database-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import mailer from "@sdxc/mail/middleware";
import { previews } from "@sdxc/mail/previews";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import type Limiters from "~/app/services/rate-limiters";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import defaultHandler from "~/app/http/controllers/default-handler";
import i18n from "~/app/http/middleware/i18n";
import { rateLimiters } from "~/app/http/middleware/rate-limiters";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import { assetResolver } from "~/app/initializers/assets";
import { polar } from "~/app/initializers/billing";
import { openDatabase } from "~/app/initializers/database";
import { SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { createMailTransport } from "~/app/initializers/mail-transport";
import { createRateLimiters } from "~/app/initializers/rate-limiters";
import registry from "~/app/models";
import routes from "~/routes/web";

/**
 * Paths exempt from cross-origin protection, each authenticated by its own
 * credential — a client secret or signed token — so misconfiguring this list
 * breaks every relying party's login at once.
 */
const COP_BYPASS_PATTERNS = ["/oauth/{path...}", "/api/{path...}", "/oidc/logout"];

/** The context a controller sees once the router's middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Types `createAction` and `createController` with the context the router's chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/** What the router reads per request, and the services a test substitutes for the bindings. */
export interface WebRouterOptions {
	/** KV namespace backing session storage. */
	kv: KVNamespace;
	/** Secret the session cookie is signed with. */
	cookieSecret: string;
	/** Whether the session cookie should be marked `Secure`. */
	secure: boolean;
	/** Cookie domain, so one sign-in covers every subdomain in production. */
	cookieDomain?: string;
	/** Billing platform published on every request; defaults to the configured Polar organization. */
	billing?: Billing;
	/** Database published on every request; defaults to this worker's own D1 connection. */
	db?: DataTable;
	/** Limiters every protected endpoint spends from; defaults to this worker's own bindings. */
	limiters?: Limiters;
	/** How mail leaves the worker; defaults to this worker's own transport. */
	mailTransport?: Transport;
}

/**
 * Builds the app's fetch-router: global middleware, then every route mapped to its
 * controller. Middleware order matters: normalizing `HEAD` to `GET` runs first so every
 * downstream check treats it like the request it probes.
 */
export function createWebRouter(options: WebRouterOptions) {
	let router = createRouter({
		middleware: [
			headRequests(),
			asyncContext(),
			database(options.db ?? openDatabase()),
			models(registry, (ctx) => ({ db: ctx.db })),
			rateLimiters(() => options.limiters ?? createRateLimiters()),
			log(logger),
			getClientIP(),
			formData(),
			methodOverride(),
			createSessionMiddleware(
				options.kv,
				options.cookieSecret,
				options.secure,
				options.cookieDomain,
			),
			i18n,
			billing({ provider: options.billing ?? polar }),
			previews(mail, { locales: SUPPORTED_LANGUAGES, enabled: import.meta.env.DEV }),
			mailer({
				transport: () => options.mailTransport ?? createMailTransport(),
				from: MAIL_FROM,
				replyTo: MAIL_REPLY_TO,
				mail,
			}),
			cop({ insecureBypassPatterns: COP_BYPASS_PATTERNS }),
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
			}),
			render({ assets: assetResolver }),
		],
		defaultHandler,
	});

	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		routes.healthcheck,
		lazy(() => import("~/app/http/controllers/healthcheck")),
	);
	router.map(
		routes.userinfo,
		lazy(() => import("~/app/http/controllers/userinfo")),
	);
	router.map(
		routes.authorize,
		lazy(() => import("~/app/http/controllers/authorize")),
	);
	router.map(
		routes.verifyEmail,
		lazy(() => import("~/app/http/controllers/verify-email")),
	);
	router.map(
		routes.password.forgot,
		lazy(() => import("~/app/http/controllers/password/forgot")),
	);
	router.map(
		routes.password.reset,
		lazy(() => import("~/app/http/controllers/password/reset")),
	);
	router.map(
		routes.auth.provider,
		lazy(() => import("~/app/http/controllers/auth/provider")),
	);
	router.map(
		routes.auth.providerCallback,
		lazy(() => import("~/app/http/controllers/auth/provider-callback")),
	);
	router.map(
		routes.auth.callback,
		lazy(() => import("~/app/http/controllers/auth/callback")),
	);
	router.map(
		routes.oauth.token,
		lazy(() => import("~/app/http/controllers/oauth/token")),
	);
	router.map(
		routes.oauth.revoke,
		lazy(() => import("~/app/http/controllers/oauth/revoke")),
	);
	router.map(
		routes.oauth.introspect,
		lazy(() => import("~/app/http/controllers/oauth/introspect")),
	);
	router.map(
		routes.oidc.logout,
		lazy(() => import("~/app/http/controllers/oidc/logout")),
	);
	router.map(
		routes.oidc.checkSession,
		lazy(() => import("~/app/http/controllers/oidc/check-session")),
	);
	router.map(
		routes.account.profile,
		lazy(() => import("~/app/http/controllers/account/profile")),
	);
	router.map(
		routes.account.profileEdit,
		lazy(() => import("~/app/http/controllers/account/profile-edit")),
	);
	router.map(
		routes.account.sessions,
		lazy(() => import("~/app/http/controllers/account/sessions")),
	);
	router.map(
		routes.account.grants,
		lazy(() => import("~/app/http/controllers/account/grants")),
	);
	router.map(
		routes.account.verifyEmailResend,
		lazy(() => import("~/app/http/controllers/account/verify-email-resend")),
	);
	router.map(
		routes.wellKnown.openidConfiguration,
		lazy(() => import("~/app/http/controllers/well-known/openid-configuration")),
	);
	router.map(
		routes.wellKnown.oauthAuthorizationServer,
		lazy(() => import("~/app/http/controllers/well-known/oauth-authorization-server")),
	);
	router.map(
		routes.wellKnown.jwks,
		lazy(() => import("~/app/http/controllers/well-known/jwks")),
	);
	router.map(
		routes.admin.dashboard,
		lazy(() => import("~/app/http/controllers/admin/dashboard")),
	);
	router.map(
		routes.admin.clients,
		lazy(() => import("~/app/http/controllers/admin/clients")),
	);
	router.map(
		routes.admin.clientNew,
		lazy(() => import("~/app/http/controllers/admin/client-new")),
	);
	router.map(
		routes.admin.client,
		lazy(() => import("~/app/http/controllers/admin/client")),
	);
	router.map(
		routes.admin.clientEdit,
		lazy(() => import("~/app/http/controllers/admin/client-edit")),
	);
	router.map(
		routes.admin.subjects,
		lazy(() => import("~/app/http/controllers/admin/subjects")),
	);
	router.map(
		routes.admin.subject,
		lazy(() => import("~/app/http/controllers/admin/subject")),
	);
	router.map(
		routes.admin.subjectEdit,
		lazy(() => import("~/app/http/controllers/admin/subject-edit")),
	);
	router.map(
		routes.api.subject,
		lazy(() => import("~/app/http/controllers/api/subject")),
	);

	return router;
}
