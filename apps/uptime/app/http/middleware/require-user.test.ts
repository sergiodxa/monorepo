/**
 * Integration tests for `requireUser`. They run the real `remix/middleware/session`
 * + this app's own `auth` middleware ahead of `requireUser`, seeding the session via
 * `login()` from a preceding test-only middleware, to verify authenticated requests
 * pass through untouched while anonymous requests are redirected home (303) with a
 * `returnTo` cookie remembering the originally requested path and query string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";

import { returnTo } from "~/app/http/cookies";
import { auth, login, type Viewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";

let viewer: Viewer = {
	id: "user_1",
	name: "Ada Lovelace",
	email: "ada@example.com",
	avatar: "https://example.com/avatar.png",
};

async function dispatch(path: string, options: { signedIn?: boolean } = {}) {
	let cookie = createCookie("test-session", { secrets: ["test-secret"] });
	let storage = createMemorySessionStorage();

	let router = createRouter({
		middleware: [
			asyncContext(),
			session(cookie, storage),
			(ctx, next) => {
				if (options.signedIn) login(viewer);
				return next();
			},
			auth,
		],
	});

	router.get("/dashboard", { middleware: [requireUser], handler: () => new Response("protected") });

	return router.fetch(new Request(`https://example.com${path}`));
}

describe("requireUser", () => {
	test("passes an authenticated request through to the downstream handler", async () => {
		let response = await dispatch("/dashboard", { signedIn: true });

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("protected");
	});

	test("redirects an anonymous request home with a See Other status", async () => {
		let response = await dispatch("/dashboard");

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/");
	});

	test("remembers the originally requested path and query string in the returnTo cookie", async () => {
		let response = await dispatch("/dashboard?tab=alerts");

		let setCookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith("uptime:return-to="));
		expect(setCookie).toBeDefined();

		let value = await returnTo.parse(setCookie!);
		expect(value).toBe("/dashboard?tab=alerts");
	});

	test("does not redirect or set a returnTo cookie for an authenticated request", async () => {
		let response = await dispatch("/dashboard", { signedIn: true });

		let setCookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith("uptime:return-to="));
		expect(setCookie).toBeUndefined();
		expect(response.status).toBe(200);
	});
});
