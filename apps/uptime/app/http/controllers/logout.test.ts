/**
 * Tests the `/logout` controller: the GET renders a confirmation form, and the POST drops
 * the stored token set, redirects through the provider's end-session endpoint carrying
 * `post_logout_redirect_uri` and `id_token_hint`, and sends `Clear-Site-Data`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv, createKVNamespace } from "@sdxc/cloudflare-mocks";
import logger from "@sdxc/logger/middleware";
import { ServiceContainer } from "@sdxc/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { renderToString } from "remix/ui/server";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLIENT_ID: "client-id",
		CLIENT_SECRET: "client-secret",
		KV: createKVNamespace(),
	}),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

/**
 * Imported after the binding mock, since the middleware chain reaches the shared
 * issuer, which reads the KV binding the moment it is built.
 */
let { default: i18n } = await import("~/app/http/middleware/i18n");
let { default: logoutController } = await import("./logout");

/** Origin the identity provider this app's accounts live at serves its documents on. */
const AUTH_ORIGIN = "https://auth.sergiodxa.com";

/**
 * The `iss` the provider publishes and writes into every token it signs, carried
 * without a scheme exactly as production does, so a logout that only works against a
 * URL identifier fails here.
 */
const AUTH_IDENTIFIER = "auth.sergiodxa.com";

/** The session key `@sdxc/auth` holds the signed-in token set under. */
const TOKENS_SESSION_KEY = "auth";

/** A stored token set, read for the `id_token_hint` the provider is handed. */
const STORED_TOKENS = {
	idToken: "raw-id-token",
	accessToken: "raw-access-token",
	refreshToken: null,
	expiresAt: null,
};

/**
 * The provider's discovery document, matching what production publishes down to its
 * scheme-less `issuer`, and naming the end-session endpoint the logout is handed to.
 */
const DISCOVERY = {
	issuer: AUTH_IDENTIFIER,
	authorization_endpoint: `${AUTH_ORIGIN}/authorize`,
	token_endpoint: `${AUTH_ORIGIN}/oauth/token`,
	jwks_uri: `${AUTH_ORIGIN}/.well-known/jwks.json`,
	userinfo_endpoint: `${AUTH_ORIGIN}/userinfo`,
	end_session_endpoint: `${AUTH_ORIGIN}/oidc/logout`,
	revocation_endpoint: `${AUTH_ORIGIN}/oauth/revoke`,
	introspection_endpoint: `${AUTH_ORIGIN}/oauth/introspect`,
	scopes_supported: ["openid", "email", "profile"],
	response_types_supported: ["code"],
	token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
	code_challenge_methods_supported: ["S256", "plain"],
};

let server = setupServer(
	http.get(`${AUTH_ORIGIN}/.well-known/openid-configuration`, () => HttpResponse.json(DISCOVERY)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Renders straight through `renderToString`, the whole document this page produces. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Installs a given `Session` instance directly, standing in for the real session middleware. */
function seedSession(session: Session): Middleware {
	return (ctx, next) => {
		ctx.set(Session, session, { property: "session" });
		return next();
	};
}

/**
 * Builds a minimal router mapping the whole `/logout` controller, anonymous by
 * default. `Auth` is seeded regardless, since `i18n`'s locale detection calls
 * `getViewer()`, which throws if `Auth` was never set at all.
 */
function createTestRouter(session: Session) {
	let { db } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			logger as Middleware,
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			seedSession(session),
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.logout, logoutController);

	return { container, router };
}

/** Runs POST /logout against a session, the way the confirmation page's form does. */
function postLogout(session: Session) {
	let { container, router } = createTestRouter(session);
	let request = new Request(`https://uptime.test${routes.logout.action.href()}`, {
		method: "POST",
	});
	return container.scope(() => router.fetch(request));
}

describe("GET /logout", () => {
	test("renders the sign-out confirmation page", async () => {
		let { container, router } = createTestRouter(new Session());

		let request = new Request(`https://uptime.test${routes.logout.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Are you sure you want to logout?");
		expect(body).toContain(`action="${routes.logout.action.href()}"`);
		expect(body).toContain(">Logout<");
	});

	test("marks the sign-out form as a document submission", async () => {
		let { container, router } = createTestRouter(new Session());

		let request = new Request(`https://uptime.test${routes.logout.index.href()}`);
		let response = await container.scope(() => router.fetch(request));
		let body = await response.text();

		let form = body.match(new RegExp(`<form[^>]*action="${routes.logout.action.href()}"[^>]*>`));
		expect(form?.[0]).toContain("data-rmx-document");
	});
});

describe("POST /logout", () => {
	/**
	 * The local record goes regardless, so a provider outage still ends the session somebody
	 * asked to end. Stated first: a discovery document reaches the shared cache once it has
	 * been read, and this is the one case that needs it unread.
	 */
	test("destroys the session and goes home when the provider cannot be reached", async () => {
		server.use(
			http.get(`${AUTH_ORIGIN}/.well-known/openid-configuration`, () => HttpResponse.error()),
		);

		let session = new Session();
		session.set(TOKENS_SESSION_KEY, STORED_TOKENS);

		let response = await postLogout(session);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(response.headers.get("Clear-Site-Data")).toBe('"*"');
		expect(session.destroyed).toBe(true);
	});

	test("drops the token set and redirects through the provider's logout endpoint with the id token hint", async () => {
		let session = new Session();
		session.set(TOKENS_SESSION_KEY, STORED_TOKENS);

		let response = await postLogout(session);

		expect(response.status).toBe(303);
		expect(response.headers.get("Clear-Site-Data")).toBe('"*"');

		let location = new URL(response.headers.get("Location")!);
		expect(location.origin + location.pathname).toBe(`${AUTH_ORIGIN}/oidc/logout`);
		expect(location.searchParams.get("id_token_hint")).toBe("raw-id-token");
		expect(location.searchParams.get("post_logout_redirect_uri")).toBe(
			`https://uptime.test${routes.home.href()}`,
		);

		expect(session.get(TOKENS_SESSION_KEY)).toBeUndefined();
	});

	test("omits id_token_hint when no token set was stored", async () => {
		let response = await postLogout(new Session());

		expect(response.status).toBe(303);
		let location = new URL(response.headers.get("Location")!);
		expect(location.searchParams.has("id_token_hint")).toBe(false);
	});
});
