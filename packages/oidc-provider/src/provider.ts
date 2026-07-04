import type { Logger } from "@pkg/logger/request";
import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/fetch-router";

import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import * as brand from "./branding/controllers/brand";
import * as clients from "./clients/controllers/clients";
import * as clientLogoutUris from "./clients/controllers/logout-uris";
import * as clientRedirectUris from "./clients/controllers/redirect-uris";
import * as clientSecrets from "./clients/controllers/secrets";
import jwks from "./discovery/controllers/jwks";
import oauth from "./discovery/controllers/oauth";
import oidc from "./discovery/controllers/oidc";
import * as setup from "./management/controllers/setup";
import * as stats from "./management/controllers/stats";
import managementAuth from "./management/middleware/management-auth";
import authorize from "./oauth/controllers/authorize";
import introspect from "./oauth/controllers/introspect";
import revoke from "./oauth/controllers/revoke";
import token from "./oauth/controllers/token";
import logout from "./oidc/controllers/logout";
import userinfo from "./oidc/controllers/userinfo";
import * as resources from "./resources/controllers/resources";
import routes from "./routes";
import index from "./shared/home";
import analyticsMiddleware from "./shared/middleware/analytics";
import database from "./shared/middleware/db";
import logger from "./shared/middleware/logger";
import notFound from "./shared/not-found";
import * as signingKeys from "./signing-keys/controllers/signing-keys";
import * as subjectConnections from "./subjects/controllers/connections";
import * as subjectGrants from "./subjects/controllers/grants";
import * as subjectPasskeys from "./subjects/controllers/passkeys";
import * as subjectSessions from "./subjects/controllers/sessions";
import * as subjects from "./subjects/controllers/subjects";
import verifyEmail from "./subjects/controllers/verify-email";
import authOptions from "./webauthn/controllers/auth-options";
import authVerify from "./webauthn/controllers/auth-verify";
import registerOptions from "./webauthn/controllers/register-options";
import registerVerify from "./webauthn/controllers/register-verify";

import type { AnalyticsSink } from "./index";

/** Runtime options the host injects into the provider's request pipeline. */
export interface ProviderRouterOptions {
	/** HMAC secret shared with the control plane for Management API internal tokens. */
	internalSecret: string;
	/** Analytics sink for authentication/registration events. */
	analytics: AnalyticsSink;
}

/**
 * Builds the OIDC provider's fetch-router bound to a database, logger, and host options.
 * @param db - Database for this tenant/instance.
 * @param requestLogger - Request-scoped logger.
 * @param options - Injected runtime options (internal secret, analytics sink).
 */
export function createProviderRouter(
	db: Database,
	requestLogger: Logger,
	options: ProviderRouterOptions,
) {
	// Typed as a non-tuple Middleware[] so the router context stays the base
	// RequestContext (with its global augmentations) instead of a middleware-branded
	// context; controllers below are typed against that same default context.
	// `formData()` is cast to the base Middleware to drop its context-transform
	// brand; the value it provides is surfaced via the global `formData` context
	// augmentation (see router-context.d.ts), not the transform.
	let middleware: Middleware[] = [
		logger(requestLogger),
		database(db),
		analyticsMiddleware(options.analytics),
		formData() as Middleware,
	];

	const router = createRouter({
		middleware,
		defaultHandler: notFound,
	});

	// The current fetch-router requires one map() per route group: a controller's
	// `actions` may only reference leaf routes, and nested route-map keys throw at
	// runtime ("call router.map() for that route map separately").
	let management: Middleware[] = [managementAuth(options.internalSecret)];

	// Public + WebAuthn + OIDC endpoints.
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

	// Management API — every route requires management-client or internal-token auth.
	// stats/setup are single routes, so they take an action object; the `action`
	// helper returns the `Action` union, narrowed here to the handler it actually is.
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
