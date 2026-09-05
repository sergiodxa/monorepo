/**
 * Specs for the two reads connecting a Remix request to the classes: the session the
 * middleware stored, and the request-plus-session pair a route hands the browser flow.
 * The flow is driven through a real router, so a login started on one request is found
 * by the next through the session cookie.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { catchResponse } from "@sdxc/catch-response-middleware";
import { MemoryAdapter } from "@sdxc/rate-limit";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter, RequestContext } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test } from "vitest";

import { Issuer } from "../issuer.js";
import { RelyingParty } from "../relying-party.js";

import { contextOf, sessionOf } from "./context.js";

/** The origin the fixture app answers on. */
const APP_ORIGIN = "https://app.example.com";

/** The issuer the fixture client is registered with, configured inline. */
const ISSUER = "https://sso.example.com";

/** The session key the login transaction occupies, read to assert what was stored. */
const TRANSACTION_SESSION_KEY = "auth:transaction";

/** A router carrying the session middleware, with `catchResponse()` below it. */
function createApp(): ReturnType<typeof createRouter> {
	let cookie = createCookie("auth-test", { secrets: ["test-secret"] });
	return createRouter({
		middleware: [session(cookie, createMemorySessionStorage()), catchResponse()],
	});
}

/** The fixture client, over an issuer that needs no discovery request. */
function createRelyingParty(options: Partial<RelyingParty.Options> = {}): RelyingParty {
	let issuer = new Issuer(ISSUER, {
		metadata: {
			issuer: ISSUER,
			authorization_endpoint: `${ISSUER}/authorize`,
			token_endpoint: `${ISSUER}/token`,
			jwks_uri: `${ISSUER}/jwks`,
		},
	});

	return new RelyingParty(issuer, {
		clientId: "client-1",
		clientSecret: "s3cr3t",
		redirectUri: `${APP_ORIGIN}/auth/callback`,
		...options,
	});
}

/** A browser against the fixture app: one cookie jar carried between visits. */
function createBrowser(router: ReturnType<typeof createRouter>) {
	let jar: string | null = null;

	return async (path: string): Promise<Response> => {
		let headers = new Headers({ "CF-Connecting-IP": "203.0.113.10" });
		if (jar) headers.set("cookie", jar);

		let response = await router.fetch(
			new Request(new URL(path, APP_ORIGIN), { headers, redirect: "manual" }),
		);
		let setCookie = response.headers.get("set-cookie");
		if (setCookie) jar = setCookie.split(";")[0] ?? jar;
		return response;
	};
}

describe("sessionOf", () => {
	test("hands back the session the middleware stored on the request", async () => {
		let router = createApp();
		router.get("/probe", (ctx) => {
			sessionOf(ctx).set("greeting", "hello");
			return Response.json({ stored: ctx.get(Session)?.get("greeting") });
		});

		let response = await router.fetch(new Request(`${APP_ORIGIN}/probe`));

		expect(await response.json()).toEqual({ stored: "hello" });
	});

	test("throws when the session middleware has not run", () => {
		let ctx = new RequestContext(new Request(`${APP_ORIGIN}/probe`));

		expect(() => sessionOf(ctx)).toThrow(/remix\/middleware\/session/);
	});
});

describe("contextOf", () => {
	test("carries the request and its session", async () => {
		let router = createApp();
		router.get("/probe", (ctx) => {
			let context = contextOf(ctx);
			return Response.json({
				url: context.request.url,
				sameSession: context.session === ctx.get(Session),
			});
		});

		let response = await router.fetch(new Request(`${APP_ORIGIN}/probe?tab=1`));

		expect(await response.json()).toEqual({ url: `${APP_ORIGIN}/probe?tab=1`, sameSession: true });
	});

	test("lets a login started on one request be found by the next", async () => {
		let rp = createRelyingParty();
		let router = createApp();
		router.get("/login", (ctx) => rp.authorize(contextOf(ctx)));
		router.get("/probe", (ctx) =>
			Response.json({ started: sessionOf(ctx).get(TRANSACTION_SESSION_KEY) !== undefined }),
		);
		let visit = createBrowser(router);

		let login = await visit("/login");
		let probe = await visit("/probe");

		expect(login.status).toBe(303);
		expect(await probe.json()).toEqual({ started: true });
	});

	test("answers a refused login with the 429 the flow throws, delivered by catchResponse", async () => {
		let rp = createRelyingParty({ rateLimit: new MemoryAdapter({ limit: 1, window: "1 minute" }) });
		let router = createApp();
		router.get("/login", (ctx) => rp.authorize(contextOf(ctx)));
		let visit = createBrowser(router);

		expect((await visit("/login")).status).toBe(303);

		let refused = await visit("/login");

		expect(refused.status).toBe(429);
		expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
	});
});
