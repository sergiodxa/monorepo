/**
 * Specs for the dashboard's OIDC client wiring: the callback URL it derives from the
 * request, the correlation values every login redirect carries, and the `id_token_hint`
 * that ends the provider's session along with the local one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSession } from "@sdxc/auth/auth-session";
import { createEnv } from "@sdxc/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

/** The provider the platform's accounts live at. */
const ISSUER = "https://sso.example.com";

/** The client the dashboard is registered as at the provider. */
const CLIENT_ID = "dashboard-client";

/** The origin the dashboard answers requests on. */
const APP_ORIGIN = "https://blog.example.com";

/** The provider's RP-initiated logout endpoint. */
const END_SESSION_ENDPOINT = `${ISSUER}/end-session`;

/**
 * Precedes the dynamic import below because the client module reads `env` for the
 * issuer and the client credentials, which are secrets in production.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		OIDC_ISSUER: ISSUER,
		OIDC_CLIENT_ID: CLIENT_ID,
		OIDC_CLIENT_SECRET: "dashboard-secret",
	}),
	DurableObject: class {},
}));

let { relyingParty } = await import("./relying-party");

/** MSW server answering the provider's discovery request. */
let server = setupServer(
	http.get(`${ISSUER}/.well-known/openid-configuration`, () =>
		HttpResponse.json({
			issuer: ISSUER,
			authorization_endpoint: `${ISSUER}/authorize`,
			token_endpoint: `${ISSUER}/token`,
			jwks_uri: `${ISSUER}/jwks`,
			end_session_endpoint: END_SESSION_ENDPOINT,
		}),
	),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * A browser: a router carrying the real session middleware, and a cookie jar that
 * survives between visits so a login's session reaches the sign-out that ends it.
 *
 * @returns The router routes are registered on, and the visit that drives them.
 */
function createAgent() {
	let cookie = createCookie("blog-saas-test", { secrets: ["test-secret"] });
	let router = createRouter({ middleware: [session(cookie, createMemorySessionStorage())] });
	let jar: string | null = null;

	async function visit(path: string): Promise<Response> {
		let headers = new Headers();
		if (jar) headers.set("cookie", jar);

		let response = await router.fetch(new Request(new URL(path, APP_ORIGIN), { headers }));
		let setCookie = response.headers.get("set-cookie");
		if (setCookie) jar = setCookie.split(";")[0] ?? jar;
		return response;
	}

	return { router, visit };
}

/**
 * Reads a parameter the assertion is about, failing loudly when the URL omits it.
 *
 * @param url - The URL to read.
 * @param name - The parameter to read.
 * @returns The parameter's value.
 */
function param(url: URL, name: string): string {
	let value = url.searchParams.get(name);
	if (value === null) throw new Error(`The URL carries no ${name} parameter`);
	return value;
}

describe("the dashboard's relying party", () => {
	test("binds every login to a nonce, a state, and a PKCE challenge", async () => {
		let { router, visit } = createAgent();
		router.get("/auth/login", (ctx) => relyingParty(ctx.url).authorize(ctx));

		let response = await visit("/auth/login");
		let authorize = new URL(response.headers.get("location") ?? "");

		expect(authorize.origin + authorize.pathname).toBe(`${ISSUER}/authorize`);
		expect(param(authorize, "client_id")).toBe(CLIENT_ID);
		expect(param(authorize, "redirect_uri")).toBe(`${APP_ORIGIN}/auth/callback`);
		expect(param(authorize, "code_challenge_method")).toBe("S256");
		expect(param(authorize, "nonce")).not.toBe(param(authorize, "state"));
	});

	test("ends the provider's session with the ID token the session holds", async () => {
		let { router, visit } = createAgent();

		router.get("/auth/login", (ctx) => {
			AuthSession.write(ctx, {
				idToken: "header.payload.signature",
				accessToken: "header.payload.signature",
				refreshToken: null,
				expiresAt: null,
			});
			return new Response("signed in");
		});

		router.get("/auth/logout", async (ctx) => {
			let url = await relyingParty(ctx.url).endSession(ctx, { returnTo: "/", redirect: false });
			return new Response(url.toString());
		});

		await visit("/auth/login");
		let response = await visit("/auth/logout");
		let logout = new URL(await response.text());

		expect(logout.origin + logout.pathname).toBe(END_SESSION_ENDPOINT);
		expect(param(logout, "id_token_hint")).toBe("header.payload.signature");
		expect(param(logout, "client_id")).toBe(CLIENT_ID);
		expect(param(logout, "post_logout_redirect_uri")).toBe(`${APP_ORIGIN}/`);
	});
});
