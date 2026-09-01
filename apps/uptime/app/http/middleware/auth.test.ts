/**
 * Integration tests for the auth middleware and the viewer accessor, running the real
 * `remix/middleware/session` + `auth` chain over a token set written into the session, so
 * the OIDC session scheme resolves a viewer the way it does for a signed-in request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter, type Middleware } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import { auth, getViewer, isAuthenticated } from "~/app/http/middleware/auth";
import { signIn, signInWithLapsedTokens } from "~/app/lib/test/auth";

let viewer: Viewer = {
	id: "user_1",
	name: "Ada Lovelace",
	email: "ada@example.com",
	avatar: "https://example.com/avatar.png",
};

function createSessionSetup() {
	return {
		cookie: createCookie("test-session", { secrets: ["test-secret"] }),
		storage: createMemorySessionStorage(),
	};
}

function run<const middleware extends readonly Middleware<any>[]>(
	middleware: middleware,
	init?: RequestInit,
) {
	let router = createRouter({ middleware });
	router.get("/", () => new Response("unreachable — test middleware should have returned first"));
	return router.fetch(new Request("https://example.com/", init));
}

describe("auth middleware", () => {
	test("getViewer returns null and isAuthenticated is false when nobody is signed in", async () => {
		let { cookie, storage } = createSessionSetup();

		let response = await run([
			asyncContext(),
			session(cookie, storage),
			auth,
			() => Response.json({ viewer: getViewer(), authenticated: isAuthenticated() }),
		]);

		let body = (await response.json()) as { viewer: unknown; authenticated: boolean };
		expect(body.viewer).toBeNull();
		expect(body.authenticated).toBe(false);
	});

	test("resolves the viewer from the signed-in request's ID token claims", async () => {
		let { cookie, storage } = createSessionSetup();

		let response = await run([
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				signIn(viewer);
				return next();
			},
			auth,
			() => Response.json({ viewer: getViewer(), authenticated: isAuthenticated() }),
		]);

		let body = (await response.json()) as { viewer: Viewer; authenticated: boolean };
		expect(body.viewer).toEqual(viewer);
		expect(body.authenticated).toBe(true);
	});

	/**
	 * Every field but the subject is a display claim the provider sends only with the
	 * scope that turns it on, so a sparse token still resolves a viewer.
	 */
	test("reads an absent display claim as empty text rather than refusing the session", async () => {
		let { cookie, storage } = createSessionSetup();

		let response = await run([
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				signIn({ id: "user_2", name: "", email: "", avatar: "" });
				return next();
			},
			auth,
			() => Response.json({ viewer: getViewer() }),
		]);

		let body = (await response.json()) as { viewer: Viewer };
		expect(body.viewer).toEqual({ id: "user_2", name: "", email: "", avatar: "" });
	});

	/**
	 * The provider grants no `offline_access`, so a login is issued no refresh token and
	 * both of its tokens lapse in an hour. A session lasts as long as its own cookie, so
	 * the hour that runs out is the tokens' and not the person's.
	 */
	test("keeps a viewer signed in past the hour its tokens lapsed at", async () => {
		let { cookie, storage } = createSessionSetup();

		let response = await run([
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				signInWithLapsedTokens(viewer);
				return next();
			},
			auth,
			() => Response.json({ viewer: getViewer(), authenticated: isAuthenticated() }),
		]);

		let body = (await response.json()) as { viewer: Viewer; authenticated: boolean };
		expect(body.authenticated).toBe(true);
		expect(body.viewer).toEqual(viewer);
	});

	/**
	 * The session arrives from a cookie, so a record an earlier version of the app
	 * wrote answers as signed out and the visitor logs in again.
	 */
	test("reads a session whose stored shape no longer parses as anonymous", async () => {
		let { cookie, storage } = createSessionSetup();

		let response = await run([
			asyncContext(),
			session(cookie, storage),
			(ctx, next) => {
				ctx.get(Session)?.set("auth", { idToken: "only-this" });
				return next();
			},
			auth,
			() => Response.json({ authenticated: isAuthenticated() }),
		]);

		let body = (await response.json()) as { authenticated: boolean };
		expect(body.authenticated).toBe(false);
	});

	test("clearing the token set leaves a later request with the same cookie anonymous", async () => {
		let { cookie, storage } = createSessionSetup();

		let first = await run([
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				signIn(viewer);
				return next();
			},
			auth,
			(ctx) => {
				expect(isAuthenticated()).toBe(true);
				ctx.get(Session)?.unset("auth");
				return new Response("signed out");
			},
		]);

		let setCookie = first.headers.getSetCookie().find((value) => value.startsWith("test-session="));
		expect(setCookie).toBeDefined();

		let second = await run(
			[
				asyncContext(),
				session(cookie, storage),
				auth,
				() => Response.json({ viewer: getViewer(), authenticated: isAuthenticated() }),
			],
			{ headers: { Cookie: setCookie!.split(";")[0]! } },
		);

		let body = (await second.json()) as { viewer: unknown; authenticated: boolean };
		expect(body.viewer).toBeNull();
		expect(body.authenticated).toBe(false);
	});

	test("throws a clear error when the session middleware has not run", async () => {
		await expect(run([asyncContext(), auth, () => new Response("unreachable")])).rejects.toThrow(
			"@pkg/auth needs remix/middleware/session installed on the router",
		);
	});
});
