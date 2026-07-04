import type { Logger } from "@pkg/logger/request";
import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/fetch-router";

import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import * as brand from "./controllers/api/brand";
import * as clientLogoutUris from "./controllers/api/client/logout-uris";
import * as clientRedirectUris from "./controllers/api/client/redirect-uris";
import * as clientSecrets from "./controllers/api/client/secrets";
import * as clients from "./controllers/api/clients";
import * as resources from "./controllers/api/resources";
import * as setup from "./controllers/api/setup";
import * as signingKeys from "./controllers/api/signing-keys";
import * as stats from "./controllers/api/stats";
import * as subjectConnections from "./controllers/api/subject/connections";
import * as subjectGrants from "./controllers/api/subject/grants";
import * as subjectPasskeys from "./controllers/api/subject/passkeys";
import * as subjectSessions from "./controllers/api/subject/sessions";
import * as subjects from "./controllers/api/subjects";
import jwks from "./controllers/discover/jwks";
import oauth from "./controllers/discover/oauth";
import oidc from "./controllers/discover/oidc";
import index from "./controllers/index";
import notFound from "./controllers/not-found";
import authorize from "./controllers/oauth/authorize";
import introspect from "./controllers/oauth/introspect";
import revoke from "./controllers/oauth/revoke";
import token from "./controllers/oauth/token";
import logout from "./controllers/oidc/logout";
import userinfo from "./controllers/oidc/userinfo";
import verifyEmail from "./controllers/verify-email";
import authOptions from "./controllers/webauthn/auth-options";
import authVerify from "./controllers/webauthn/auth-verify";
import registerOptions from "./controllers/webauthn/register-options";
import registerVerify from "./controllers/webauthn/register-verify";
import database from "./middleware/db";
import logger from "./middleware/logger";
import managementAuth from "./middleware/management-auth";
import routes from "./routes";

export default (db: Database, requestLogger: Logger) => {
	// Typed as a non-tuple Middleware[] so the router context stays the base
	// RequestContext (with its global augmentations) instead of a middleware-branded
	// context; controllers below are typed against that same default context.
	// `formData()` is cast to the base Middleware to drop its context-transform
	// brand; the value it provides is surfaced via the global `formData` context
	// augmentation (see src/router-context.d.ts), not the transform.
	let middleware: Middleware[] = [logger(requestLogger), database(db), formData() as Middleware];

	const router = createRouter({
		middleware,
		defaultHandler: notFound,
	});

	// The current fetch-router requires one map() per route group: a controller's
	// `actions` may only reference leaf routes, and nested route-map keys throw at
	// runtime ("call router.map() for that route map separately").
	let management: Middleware[] = [managementAuth()];

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
};
