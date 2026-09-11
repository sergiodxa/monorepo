/**
 * Assembles the OIDC provider's fetch-router: middleware pipeline plus route map.
 *
 * Wires every controller (OAuth, OIDC, discovery, WebAuthn, and the Management
 * API) to its route, publishes the invocation's log as `ctx.log`, and publishes the
 * host's database as `ctx.db` so handlers read the tenant they are answering for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import * as brand from "./branding/controllers/brand.js";
import * as clients from "./clients/controllers/clients.js";
import * as clientLogoutUris from "./clients/controllers/logout-uris.js";
import * as clientRedirectUris from "./clients/controllers/redirect-uris.js";
import * as clientSecrets from "./clients/controllers/secrets.js";
import jwks from "./discovery/controllers/jwks.js";
import oauth from "./discovery/controllers/oauth.js";
import oidc from "./discovery/controllers/oidc.js";
import * as setup from "./management/controllers/setup.js";
import * as stats from "./management/controllers/stats.js";
import managementAuth from "./management/middleware/management-auth.js";
import authorize from "./oauth/controllers/authorize.js";
import introspect from "./oauth/controllers/introspect.js";
import revoke from "./oauth/controllers/revoke.js";
import token from "./oauth/controllers/token.js";
import logout from "./oidc/controllers/logout.js";
import userinfo from "./oidc/controllers/userinfo.js";
import * as resources from "./resources/controllers/resources.js";
import routes from "./routes.js";
import index from "./shared/home.js";
import analyticsMiddleware from "./shared/middleware/analytics.js";
import database from "./shared/middleware/database.js";
import notFound from "./shared/not-found.js";
import * as signingKeys from "./signing-keys/controllers/signing-keys.js";
import * as subjectConnections from "./subjects/controllers/connections.js";
import * as subjectGrants from "./subjects/controllers/grants.js";
import * as subjectPasskeys from "./subjects/controllers/passkeys.js";
import * as subjectSessions from "./subjects/controllers/sessions.js";
import * as subjects from "./subjects/controllers/subjects.js";
import verifyEmail from "./subjects/controllers/verify-email.js";
import authOptions from "./webauthn/controllers/auth-options.js";
import authVerify from "./webauthn/controllers/auth-verify.js";
import registerOptions from "./webauthn/controllers/register-options.js";
import registerVerify from "./webauthn/controllers/register-verify.js";

import type { AnalyticsSink } from "./index.js";

/** Runtime options the host injects into the provider's request pipeline. */
export interface ProviderRouterOptions {
	/** HMAC secret shared with the control plane for Management API internal tokens. */
	internalSecret: string;
	/** Analytics sink for authentication/registration events. */
	analytics: AnalyticsSink;
}

/**
 * Builds the OIDC provider's fetch-router bound to a database and host options.
 * `log()` takes no configuration: a host that wraps its entry point in
 * `logger.open("request").run(...)` has this router join that log, so every record
 * carries the host's `service`; without a host log, each request opens a bare one.
 * @param db - Database for this tenant/instance.
 * @param options - Injected runtime options (internal secret, analytics sink).
 */
export function createProviderRouter(db: Database, options: ProviderRouterOptions) {
	/**
	 * A non-tuple `Middleware[]` keeps the router context at the base
	 * `RequestContext`, so controllers type against it; `log()` and `formData()`
	 * are cast since their values surface through the global `log` / `formData`
	 * augmentations.
	 */
	let middleware: Middleware[] = [
		database(() => db),
		log() as Middleware,
		asyncContext(),
		analyticsMiddleware(options.analytics),
		formData() as Middleware,
	];

	const router = createRouter({
		middleware,
		defaultHandler: notFound,
	});

	/**
	 * The fetch-router requires one `map()` per route group: a controller's `actions`
	 * may only reference leaf routes; nested route-map keys throw at runtime with
	 * "call router.map() for that route map separately".
	 */
	let management: Middleware[] = [managementAuth(options.internalSecret)];

	router.map(routes.index, index);
	router.map(routes.verifyEmail, verifyEmail);

	router.map(routes.webauthn.register, {
		actions: { options: registerOptions, verify: registerVerify },
	});
	router.map(routes.webauthn.auth, {
		actions: { options: authOptions, verify: authVerify },
	});

	router.map(routes.oauth.authorize, authorize);
	router.map(routes.oauth.token, token);
	router.map(routes.oauth.revoke, revoke);
	router.map(routes.oauth.introspect, introspect);

	router.map(routes.oidc.userinfo, userinfo);
	router.map(routes.oidc.logout, logout);

	router.map(routes.discover.jwks, jwks);
	router.map(routes.discover.oidc, oidc);
	router.map(routes.discover.oauth, oauth);

	/**
	 * Every Management API route requires management-client or internal-token auth.
	 * `stats`/`setup` are single routes, so they take a handler directly; the `action`
	 * helper's `Action` union is narrowed here to the handler it actually is.
	 */
	router.map(routes.api.stats, {
		middleware: management,
		handler: stats.show as RequestHandler,
	});
	router.map(routes.api.setup, {
		middleware: management,
		handler: setup.create as RequestHandler,
	});

	router.map(routes.api.clients, { middleware: management, actions: clients });
	router.map(routes.api.clients.secrets, { middleware: management, actions: clientSecrets });
	router.map(routes.api.clients["redirect-uris"], {
		middleware: management,
		actions: clientRedirectUris,
	});
	router.map(routes.api.clients["logout-uris"], {
		middleware: management,
		actions: clientLogoutUris,
	});

	router.map(routes.api.subjects, { middleware: management, actions: subjects });
	router.map(routes.api.subjects.sessions, { middleware: management, actions: subjectSessions });
	router.map(routes.api.subjects.grants, { middleware: management, actions: subjectGrants });
	router.map(routes.api.subjects.passkeys, { middleware: management, actions: subjectPasskeys });
	router.map(routes.api.subjects.connections, {
		middleware: management,
		actions: subjectConnections,
	});

	router.map(routes.api.resources, { middleware: management, actions: resources });
	router.map(routes.api.brand, { middleware: management, actions: brand });
	router.map(routes.api["signing-keys"], { middleware: management, actions: signingKeys });

	return router;
}
