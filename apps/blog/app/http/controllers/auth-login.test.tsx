/**
 * Tests the `/login` routes and the OIDC callback as one round trip over a cookie jar: a
 * login opened for a CMS page lands back on that page, query included, a destination off
 * this site lands on the dashboard, and a visitor already signed in skips the round trip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createKVNamespace } from "@sdxc/cloudflare-mocks";
import { JWK, JWT } from "@sdxc/jwt";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import auth from "~/app/http/middleware/auth";
import database from "~/app/http/middleware/database";
import createEnvMiddleware from "~/app/http/middleware/env";
import models from "~/app/http/middleware/models";
import { testDatabase } from "~/app/test/database";
import { blankSearchFrame } from "~/app/test/frames";
import { bindModels } from "~/app/test/models";
import routes from "~/routes/web";

import { htmlRenderer } from "../../../bootstrap/app";

import { callbackAction, loginController } from "./auth";

/** The origin the blog answers on, which every login destination is held to. */
const APP_ORIGIN = "https://blog.test";

/** The identifier the provider writes as `iss`, scheme-less as it publishes it. */
const ISSUER = "auth.sergiodxa.com";

/** Where the provider serves the endpoints a login reaches. */
const ISSUER_ORIGIN = "https://auth.sergiodxa.com";

/** The client the blog is registered as at the provider. */
const CLIENT_ID = "blog-client";

/** The page the share sheet opens, carrying the shared URL in its query. */
const SHARED_PAGE = "/cms/bookmarks/new?url=https%3A%2F%2Fexample.com%2Fpost%3Fid%3D7";

/** Destinations a browser would follow off this site. */
const OFF_SITE_DESTINATIONS = ["https://evil.com", "//evil.com", "/\\evil.com"];

let keys: JWK.KeyPair[];

/** Serves the key set for the whole file, so a per-test reset leaves it published. */
let server = setupServer(
	http.get(`${ISSUER_ORIGIN}/.well-known/jwks.json`, () => HttpResponse.json(JWK.toJSON(keys))),
);

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
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

/**
 * Answers the token endpoint with a grant for the login the authorization redirect started,
 * its ID token bound to that login's nonce.
 *
 * @param authorization Where the login sent the browser to authenticate.
 * @param claims Claims layered over the ID token's fixture profile.
 */
async function serveGrant(authorization: URL, claims: Record<string, unknown>): Promise<void> {
	let idToken = await new JWT({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: "subject-1",
		exp: "1h",
		iat: Math.floor(Date.now() / 1000),
		nonce: authorization.searchParams.get("nonce"),
		email: "sergio@example.com",
		name: "Sergio",
		preferred_username: "sergiodxa",
		picture: "https://example.com/avatar.png",
		...claims,
	}).sign(JWK.Algorithm.ES256, keys);

	let accessToken = await new JWT({
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: "subject-1",
		client_id: CLIENT_ID,
		scope: "openid profile email",
		exp: "1h",
	}).sign(JWK.Algorithm.ES256, keys);

	server.use(
		http.post(`${ISSUER_ORIGIN}/oauth/token`, () =>
			HttpResponse.json({
				access_token: accessToken,
				token_type: "Bearer",
				expires_in: 3600,
				refresh_token: "refresh-token",
				id_token: idToken,
			}),
		),
	);
}

/** A browser holding one cookie jar against the login routes. */
interface Browser {
	/** Requests a path the way a browser does, sending and keeping the session cookie. */
	visit(path: string, init?: RequestInit): Promise<Response>;
	/**
	 * Opens the login screen at `loginPath`, submits it, and follows the provider back with
	 * an ID token carrying `claims` over its fixture profile.
	 */
	signIn(loginPath: string, claims?: Record<string, unknown>): Promise<Response>;
}

/**
 * Builds the login routes behind the session, database, and auth middleware the app runs
 * them behind, so the return path travels from the login screen's form through the
 * provider round trip the way it does in production.
 *
 * @param db The database the callback reconciles the account in.
 */
function openBrowser(db: Database): Browser {
	let jar: string | null = null;
	let router = createRouter({
		middleware: [
			createEnvMiddleware(createEnv()),
			log(createLogger({ service: "blog", sink: () => undefined })),
			asyncContext(),
			session(
				createCookie("blog-test", { secrets: ["test-secret"] }),
				createMemorySessionStorage(),
			),
			database(() => db),
			models(),
			auth,
			...htmlRenderer(),
		],
	});

	router.map(routes.searchFrame, blankSearchFrame);
	router.map(routes.auth.login, loginController);
	router.map(routes.auth.callback, callbackAction);

	async function visit(path: string, init: RequestInit = {}): Promise<Response> {
		let headers = new Headers(init.headers);
		if (jar) headers.set("cookie", jar);

		let response = await router.fetch(
			new Request(new URL(path, APP_ORIGIN), { ...init, headers, redirect: "manual" }),
		);

		let setCookie = response.headers.get("set-cookie");
		if (setCookie) jar = setCookie.split(";")[0] ?? jar;

		return response;
	}

	return {
		visit,

		async signIn(loginPath, claims = {}) {
			let screen = await visit(loginPath);
			let action = formActions(await screen.text()).find((it) =>
				it.startsWith(routes.auth.login.action.href()),
			);

			let started = await visit((action ?? "").replaceAll("&amp;", "&"), {
				method: routes.auth.login.action.method,
			});
			let authorization = new URL(started.headers.get("location") ?? APP_ORIGIN);
			await serveGrant(authorization, claims);

			let state = authorization.searchParams.get("state") ?? "";
			return visit(`${routes.auth.callback.href()}?code=auth-code&state=${state}`);
		},
	};
}

/** Every form target a page holds, the search dialog's included, in document order. */
function formActions(html: string): string[] {
	return [...html.matchAll(/<form[^>]*\saction="([^"]*)"/g)].map((match) => match[1] ?? "");
}

/** The login screen asking to come back to `next`, as the CMS guard links to it. */
function loginTo(next: string): string {
	return routes.auth.login.index.href(null, { searchParams: { next } });
}

describe("signing in from the login screen", () => {
	test("lands on the page the login screen was opened for, query included", async () => {
		let browser = openBrowser(await testDatabase());

		let response = await browser.signIn(loginTo(SHARED_PAGE));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(SHARED_PAGE);
	});

	test("lands on the dashboard when the login screen names no page", async () => {
		let browser = openBrowser(await testDatabase());

		let response = await browser.signIn(routes.auth.login.index.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.cms.dashboard.href());
	});

	test.each(OFF_SITE_DESTINATIONS)("lands on the dashboard for `next` set to %j", async (next) => {
		let browser = openBrowser(await testDatabase());

		let response = await browser.signIn(loginTo(next));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.cms.dashboard.href());
	});

	/** A login abandoned on one screen leaves nothing behind for the next screen's login. */
	test("lands where the screen it submitted asked", async () => {
		let browser = openBrowser(await testDatabase());
		await browser.visit(loginTo(routes.cms.articles.index.href()));

		let response = await browser.signIn(routes.auth.login.index.href());

		expect(response.headers.get("location")).toBe(routes.cms.dashboard.href());
	});

	test("leaves a visitor's session unwritten when the login screen names no page", async () => {
		let browser = openBrowser(await testDatabase());

		let response = await browser.visit(routes.auth.login.index.href());

		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toBeNull();
	});
});

describe("opening the login screen while signed in", () => {
	test("goes straight to the page its `next` names", async () => {
		let browser = openBrowser(await testDatabase());
		await browser.signIn(routes.auth.login.index.href());

		let response = await browser.visit(loginTo(SHARED_PAGE));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(SHARED_PAGE);
	});

	test.each(OFF_SITE_DESTINATIONS)("goes to the dashboard for `next` set to %j", async (next) => {
		let browser = openBrowser(await testDatabase());
		await browser.signIn(routes.auth.login.index.href());

		let response = await browser.visit(loginTo(next));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.cms.dashboard.href());
	});
});

describe("signing in with the email an existing account holds", () => {
	/** Creates the admin account registered under the fixture profile's email. */
	async function seedAdmin(db: Database) {
		return unwrap(
			await bindModels(db).users.create({
				subject_id: "subject-admin",
				role: "admin",
				email: "sergio@example.com",
				avatar: "https://example.com/admin.png",
				username: "admin",
				display_name: "Admin",
			}),
		);
	}

	test("refuses an unverified email and leaves the visitor signed out", async () => {
		let db = await testDatabase();
		let admin = await seedAdmin(db);
		let browser = openBrowser(db);

		let response = await browser.signIn(routes.auth.login.index.href(), {
			email_verified: false,
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Verify it with the identity provider");
		expect(await bindModels(db).users.find(admin.id)).toEqual(admin);

		let screen = await browser.visit(routes.auth.login.index.href());
		expect(screen.status).toBe(200);
	});

	test("links a verified email to that account", async () => {
		let db = await testDatabase();
		let admin = await seedAdmin(db);
		let browser = openBrowser(db);

		let response = await browser.signIn(routes.auth.login.index.href(), { email_verified: true });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.cms.dashboard.href());
		expect((await bindModels(db).users.find(admin.id))?.subject_id).toBe("subject-1");
	});
});
