/**
 * Tests the `/logout` controller: the GET confirmation page renders its heading and a
 * form posting to the logout action; the POST action drops the stored token set,
 * redirects through the provider's RP-initiated logout endpoint with a
 * `post_logout_redirect_uri` back to the homepage (plus `id_token_hint` when a token
 * set was stored), sends `Clear-Site-Data`, and still signs the person out locally
 * when the provider cannot be reached.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv, createKVNamespace } from "@pkg/cloudflare-mocks";
import logger from "@pkg/logger/middleware";
import { ServiceContainer } from "@pkg/service-container";
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

/** The identity provider this app's accounts live at. */
const ISSUER = "https://auth.sergiodxa.com";

/** The session key `@pkg/auth` holds the signed-in token set under. */
const TOKENS_SESSION_KEY = "auth";

/** A stored token set, read for the `id_token_hint` the provider is handed. */
const STORED_TOKENS = {
	idToken: "raw-id-token",
	accessToken: "raw-access-token",
	refreshToken: null,
	expiresAt: null,
};

/** The provider's discovery document, which names the end-session endpoint. */
const DISCOVERY = {
	issuer: ISSUER,
	authorization_endpoint: `${ISSUER}/authorize`,
	token_endpoint: `${ISSUER}/oauth/token`,
	jwks_uri: `${ISSUER}/.well-known/jwks.json`,
	end_session_endpoint: `${ISSUER}/oidc/logout`,
};

let server = setupServer(
	http.get(`${ISSUER}/.well-known/openid-configuration`, () => HttpResponse.json(DISCOVERY)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
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
});

describe("POST /logout", () => {
	/**
	 * A provider outage must not trap somebody in a session they asked to end, so the
	 * local record goes regardless and the browser lands on the homepage.
	 *
	 * Stated first because a document only reaches the shared cache once it has been
	 * read successfully, and this is the one case that needs it unread.
	 */
	test("destroys the session and goes home when the provider cannot be reached", async () => {
		server.use(http.get(`${ISSUER}/.well-known/openid-configuration`, () => HttpResponse.error()));

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
		expect(location.origin + location.pathname).toBe(`${ISSUER}/oidc/logout`);
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
