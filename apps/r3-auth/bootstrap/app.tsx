/**
 * Composition root for the authorization server. Builds the fetch router with the
 * global middleware chain every request passes through and maps each route to its
 * controller, so the wiring lives in one place rather than being spread across
 * controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, Router } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import { asyncContext } from "remix/async-context-middleware";
import { cop } from "remix/cop-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import grants from "~/app/http/controllers/account/grants";
import profile from "~/app/http/controllers/account/profile";
import profileEdit from "~/app/http/controllers/account/profile-edit";
import sessions from "~/app/http/controllers/account/sessions";
import adminClient from "~/app/http/controllers/admin/client";
import adminClientEdit from "~/app/http/controllers/admin/client-edit";
import adminClientNew from "~/app/http/controllers/admin/client-new";
import adminClients from "~/app/http/controllers/admin/clients";
import adminDashboard from "~/app/http/controllers/admin/dashboard";
import adminSubject from "~/app/http/controllers/admin/subject";
import adminSubjectEdit from "~/app/http/controllers/admin/subject-edit";
import adminSubjects from "~/app/http/controllers/admin/subjects";
import apiSubject from "~/app/http/controllers/api/subject";
import selfCallback from "~/app/http/controllers/auth/callback";
import providerLogin from "~/app/http/controllers/auth/provider";
import providerCallback from "~/app/http/controllers/auth/provider-callback";
import authorizeController from "~/app/http/controllers/authorize";
import defaultHandler from "~/app/http/controllers/default-handler";
import healthcheck from "~/app/http/controllers/healthcheck";
import home from "~/app/http/controllers/home";
import introspect from "~/app/http/controllers/oauth/introspect";
import revoke from "~/app/http/controllers/oauth/revoke";
import token from "~/app/http/controllers/oauth/token";
import checkSession from "~/app/http/controllers/oidc/check-session";
import logout from "~/app/http/controllers/oidc/logout";
import userinfo from "~/app/http/controllers/userinfo";
import jwks from "~/app/http/controllers/well-known/jwks";
import oauthAuthorizationServer from "~/app/http/controllers/well-known/oauth-authorization-server";
import openidConfiguration from "~/app/http/controllers/well-known/openid-configuration";
import i18n from "~/app/http/middleware/i18n";
import logger from "~/app/http/middleware/logger";
import { createSessionMiddleware } from "~/app/http/middleware/session";
import routes from "~/routes/web";

/**
 * Paths cross-origin protection must not apply to.
 *
 * Every one of them is a cross-origin `POST` by design: a relying party exchanging a
 * code, a resource server introspecting a token, and a client's back-channel logout
 * call all arrive from another origin with credentials of their own — a client secret,
 * a signed token — which is a stronger claim than an `Origin` header. Getting this list
 * wrong does not fail loudly: it fails as every relying party's login breaking at once.
 */
const COP_BYPASS_PATTERNS = ["/oauth/{path...}", "/api/{path...}", "/oidc/logout"];

namespace application {
	export interface Options {
		/** KV namespace backing session storage. */
		kv: KVNamespace;
		/** Secret the session cookie is signed with. */
		cookieSecret: string;
		/** Whether the session cookie should be marked `Secure`. */
		secure: boolean;
		/** Cookie domain, so one sign-in covers every subdomain in production. */
		cookieDomain?: string;
	}
}

/** Builds the app's fetch-router: global middleware, then every route mapped to its controller. */
export default function application(options: application.Options) {
	// A non-tuple `Middleware[]`: the values these middleware publish are declared with
	// `declare module "remix/fetch-router"` in their own modules rather than carried
	// through the chain's transform types.
	let middleware: Middleware[] = [
		asyncContext(),
		logger,
		formData() as Middleware,
		methodOverride(),
		createSessionMiddleware(
			options.kv,
			options.cookieSecret,
			options.secure,
			options.cookieDomain,
		) as Middleware,
		// After the session middleware, whose session a stored language preference would
		// be read from, and before rendering, which is what translates.
		i18n,
		cop({ insecureBypassPatterns: COP_BYPASS_PATTERNS }),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({ middleware, defaultHandler });

	router.map(routes.home, home);
	router.map(routes.healthcheck, healthcheck);
	router.map(routes.userinfo, userinfo);
	router.map(routes.authorize, authorizeController);

	router.map(routes.auth.provider, providerLogin);
	router.map(routes.auth.providerCallback, providerCallback);
	router.map(routes.auth.callback, selfCallback);

	router.map(routes.oauth.token, token);
	router.map(routes.oauth.revoke, revoke);
	router.map(routes.oauth.introspect, introspect);

	router.map(routes.oidc.logout, logout);
	router.map(routes.oidc.checkSession, checkSession);

	router.map(routes.account.profile, profile);
	router.map(routes.account.profileEdit, profileEdit);
	router.map(routes.account.sessions, sessions);
	router.map(routes.account.grants, grants);

	router.map(routes.wellKnown.openidConfiguration, openidConfiguration);
	router.map(routes.wellKnown.oauthAuthorizationServer, oauthAuthorizationServer);
	router.map(routes.wellKnown.jwks, jwks);

	// One call per route map: middleware does not cascade between them, so each admin
	// controller carries `requireAdmin` in its own chain rather than relying on a parent.
	router.map(routes.admin.dashboard, adminDashboard);
	router.map(routes.admin.clients, adminClients);
	router.map(routes.admin.clientNew, adminClientNew);
	router.map(routes.admin.client, adminClient);
	router.map(routes.admin.clientEdit, adminClientEdit);
	router.map(routes.admin.subjects, adminSubjects);
	router.map(routes.admin.subject, adminSubject);
	router.map(routes.admin.subjectEdit, adminSubjectEdit);

	router.map(routes.api.subject, apiSubject);

	return router;
}

/** Creates a request-scoped renderer for server-side HTML responses. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, src, target, context);
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return new Response(stream, { ...init, headers });
	};
}

/** Fetches frame HTML through the current router so SSR frames share request context. */
async function resolveFrame(
	router: Router,
	request: Request,
	src: string,
	target?: string,
	context?: ResolveFrameContext,
) {
	let frameSrc = context?.currentFrameSrc ?? request.url;
	let url = new URL(src, frameSrc);
	let headers = new Headers();
	headers.set("accept", "text/html");
	headers.set("accept-encoding", "identity");
	headers.set("x-remix-frame", "true");

	if (target) headers.set("x-remix-target", target);

	let cookie = request.headers.get("cookie");
	if (cookie) headers.set("cookie", cookie);

	let res = await followFrameRedirects(router, request, url, headers);
	if (res.body) return res.body;
	if (res.ok) return res.text();
	return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`;
}

/** Follows SSR frame redirects without letting fetch auto-follow with changed headers. */
async function followFrameRedirects(router: Router, request: Request, url: URL, headers: Headers) {
	let currentUrl = url;
	let redirectsRemaining = 10;

	while (true) {
		let res = await router.fetch(
			new Request(currentUrl, { method: "GET", headers, signal: request.signal }),
		);
		let location = res.headers.get("location");
		if (!location || res.status < 300 || res.status >= 400) return res;

		if (redirectsRemaining-- <= 0) throw new Error("Too many frame redirects");
		currentUrl = new URL(location, currentUrl);
	}
}
