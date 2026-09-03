/**
 * Tests the `/logout` routes: a signed-in editor reaches the confirmation page and the
 * sign-out behind it, the sign-out hands the provider the `id_token_hint` naming its own
 * session and destroys the local one, and a reader carrying no session is answered with
 * the feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createKVNamespace } from "@sdxc/cloudflare-mocks";
import { setupServer } from "msw/node";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type * as schema from "~/database/schema";

import createEnvMiddleware from "~/app/http/middleware/env";
import routes from "~/routes/web";

import { createHtmlRenderer } from "../../../bootstrap/app";

import { logoutController } from "./auth";

/** The origin the blog answers on, which every redirect is read against. */
const APP_ORIGIN = "https://blog.test";

/** Where the provider serves the end-session endpoint the sign-out is handed to. */
const AUTH_ORIGIN = "https://auth.sergiodxa.com";

/** The client the blog is registered as at the provider. */
const CLIENT_ID = "blog-client";

/** The session key `@sdxc/auth` holds the signed-in token set under. */
const TOKENS_SESSION_KEY = "auth";

/** The token set a completed login leaves behind, read for the `id_token_hint`. */
const STORED_TOKENS = {
	idToken: "raw-id-token",
	accessToken: "raw-access-token",
	refreshToken: null,
	expiresAt: null,
};

/** The account a signed-in request resolves to. */
const EDITOR: schema.SelectUser = {
	id: "user-1",
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
	subject_id: "subject-1",
	role: "admin",
	email: "sergio@example.com",
	avatar: "https://example.com/avatar.png",
	username: "sergiodxa",
	display_name: "Sergio",
};

/**
 * Fails the run on any outbound request, since the sign-out reads the end-session
 * endpoint from the metadata the issuer states and answers the reader from that alone.
 */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

/** The bindings the app reads its client credentials and its caches out of. */
function createEnv(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID,
		CLIENT_SECRET: "s3cr3t",
		COOKIE_SESSION_SECRET: "cookie-secret",
		AUTH: createKVNamespace(),
		REDIRECTS: createKVNamespace(),
		CACHE: createKVNamespace(),
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => undefined,
	};
}

/** A session carrying the token set a completed login stored. */
function signedInSession(): Session {
	let session = new Session();
	session.set(TOKENS_SESSION_KEY, STORED_TOKENS);
	return session;
}

/**
 * Builds a router carrying what the logout routes read: the env the client credentials
 * come from, the session they tear down, and the auth state their guard measures. A
 * `viewer` of `null` leaves the request anonymous.
 *
 * @param session The session the request arrives with.
 * @param viewer The account the request is signed in as.
 * @returns The router the request is fetched through.
 */
function createTestRouter(session: Session, viewer: schema.SelectUser | null) {
	let router = createRouter({
		middleware: [
			createEnvMiddleware(createEnv()),
			asyncContext(),
			/**
			 * Installs the session and the resolved identity the way the app's session and
			 * auth middleware do, keeping the provider's key set and the account table out
			 * of a test about what the sign-out answers.
			 */
			(ctx, next) => {
				ctx.set(Session, session);
				ctx.set(
					Auth,
					viewer ? { ok: true, identity: viewer, method: "oidc-session" } : { ok: false },
				);
				return next();
			},
			renderWith(createHtmlRenderer),
		],
	});

	router.map(routes.auth.logout, logoutController);

	return router;
}

/** Follows the sign-out link the way a browser does. */
function visitLogout(session: Session, viewer: schema.SelectUser | null): Promise<Response> {
	return createTestRouter(session, viewer).fetch(
		new Request(new URL(routes.auth.logout.index.href(), APP_ORIGIN), { redirect: "manual" }),
	);
}

/** Submits the confirmation page's form. */
function submitLogout(session: Session, viewer: schema.SelectUser | null): Promise<Response> {
	return createTestRouter(session, viewer).fetch(
		new Request(new URL(routes.auth.logout.action.href(), APP_ORIGIN), {
			method: routes.auth.logout.action.method,
			redirect: "manual",
		}),
	);
}

describe("GET /logout", () => {
	test("renders the confirmation page for the editor it belongs to", async () => {
		let response = await visitLogout(signedInSession(), EDITOR);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("Location")).toBeNull();
		expect(html).toContain("Are you sure you want to sign out from CMS?");
		expect(html).toContain(`action="${routes.auth.logout.action.href()}"`);
	});

	test("reads the feed to a visitor carrying no session", async () => {
		let response = await visitLogout(new Session(), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.feed.href());
	});
});

describe("POST /logout", () => {
	test("hands the provider the id token hint and destroys the local session", async () => {
		let session = signedInSession();

		let response = await submitLogout(session, EDITOR);
		let location = new URL(response.headers.get("Location") ?? "", APP_ORIGIN);

		expect(response.status).toBe(303);
		expect(location.origin + location.pathname).toBe(`${AUTH_ORIGIN}/oidc/logout`);
		expect(location.searchParams.get("id_token_hint")).toBe(STORED_TOKENS.idToken);
		expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
		expect(location.searchParams.get("post_logout_redirect_uri")).toBe(
			`${APP_ORIGIN}${routes.feed.href()}`,
		);
		expect(response.headers.get("Clear-Site-Data")).toBe('"*"');
		expect(session.destroyed).toBe(true);
	});

	/**
	 * A tab left open past its session clicks the same button, and the click has to
	 * finish the sign-out it was pressed for: the reader lands on the feed with the
	 * origin's state cleared, and the provider is spared a hop that carries no hint.
	 */
	test("answers a visitor carrying no session with the feed", async () => {
		let session = new Session();

		let response = await submitLogout(session, null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.feed.href());
		expect(response.headers.get("Clear-Site-Data")).toBe('"*"');
		expect(session.destroyed).toBe(true);
	});

	/**
	 * The sign-out stays terminal on this side whatever the handoff refuses with, so a
	 * session already gone leaves the reader signed out on the feed rather than on an
	 * error page.
	 */
	test("ends the session here when the provider handoff cannot be built", async () => {
		let session = signedInSession();
		session.destroy();

		let response = await submitLogout(session, EDITOR);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.feed.href());
		expect(response.headers.get("Clear-Site-Data")).toBe('"*"');
	});
});
