/**
 * Integration tests for the auth middleware's session-identity helpers
 * (`getViewer`, `isAuthenticated`, `login`, `logout`, `getIdToken`, `setIdToken`).
 * They run the real `remix/middleware/session` + `auth()` chain — seeding the
 * session via `login()` from a preceding test-only middleware — so the session
 * auth scheme's `read`/`verify`/`invalidate` hooks execute for real instead of
 * being stubbed out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createCookie } from "remix/cookie";
import { asyncContext, getContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter, type Middleware } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";

import {
	auth,
	getIdToken,
	getViewer,
	isAuthenticated,
	login,
	logout,
	setIdToken,
	type Viewer,
} from "~/app/http/middleware/auth";

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

describe("auth middleware session helpers", () => {
	test("getViewer returns null and isAuthenticated is false when nobody has logged in", async () => {
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

	test("login makes the viewer resolvable via getViewer/isAuthenticated within the same request", async () => {
		let { cookie, storage } = createSessionSetup();

		let response = await run([
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				login(viewer);
				return next();
			},
			auth,
			() => Response.json({ viewer: getViewer(), authenticated: isAuthenticated() }),
		]);

		let body = (await response.json()) as { viewer: Viewer; authenticated: boolean };
		expect(body.viewer).toEqual(viewer);
		expect(body.authenticated).toBe(true);
	});

	test("login regenerates the session id to guard against session fixation", async () => {
		let { cookie, storage } = createSessionSetup();
		let ids: { before?: string; after?: string } = {};

		await run([
			asyncContext(),
			session(cookie, storage),
			() => {
				let currentSession = getContext().get(Session);
				if (!currentSession) throw new Error("Session middleware did not set a session.");
				ids.before = currentSession.id;
				login(viewer);
				ids.after = currentSession.id;
				return new Response("ok");
			},
		]);

		expect(ids.before).toBeDefined();
		expect(ids.after).toBeDefined();
		expect(ids.before).not.toBe(ids.after);
	});

	test("setIdToken/getIdToken round-trip the upstream OIDC id token in the session", async () => {
		let { cookie, storage } = createSessionSetup();

		let response = await run([
			asyncContext(),
			session(cookie, storage),
			() => {
				let before = getIdToken();
				setIdToken("upstream-id-token");
				return Response.json({ before, after: getIdToken() });
			},
		]);

		let body = (await response.json()) as { before: string | null; after: string | null };
		expect(body.before).toBeNull();
		expect(body.after).toBe("upstream-id-token");
	});

	test("logout destroys the session so a later request with the cleared cookie is anonymous", async () => {
		let { cookie, storage } = createSessionSetup();

		let first = await run([
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				login(viewer);
				return next();
			},
			auth,
			() => {
				expect(isAuthenticated()).toBe(true);
				logout();
				return new Response("logged out");
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
		await expect(
			run([
				asyncContext(),
				() => {
					login(viewer);
					return new Response("unreachable");
				},
			]),
		).rejects.toThrow("Session not found in context. Make sure to use the session middleware.");
	});
});
