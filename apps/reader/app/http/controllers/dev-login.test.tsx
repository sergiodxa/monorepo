/**
 * Tests `/dev/login`: with the local switch off, or on a host other than this machine, the
 * route answers the 404 page and the header offers no link; with both, the button writes a
 * session the app's own auth scheme reads back as the seed reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { AuthSession } from "@sdxc/auth/auth-session";
import { sessionOf } from "@sdxc/auth/remix/context";
import { sessionScheme } from "@sdxc/auth/remix/schemes";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { Auth, auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { AppRouter } from "~/app/test/controller";

import i18n from "~/app/http/middleware/i18n";
import presentation from "~/app/http/middleware/presentation";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { documentRendering } from "~/app/test/rendering";
import { createUserStoreDouble } from "~/app/test/store";
import routes from "~/routes/web";

/** The local switch as a test sets it; every other binding answers what the stub does. */
let overrides: Record<string, string> = {};
vi.doMock("cloudflare:workers", async (original) => {
	let actual = await original<typeof import("cloudflare:workers")>();
	return {
		...actual,
		env: new Proxy(actual.env, {
			has: (target, key) => (typeof key === "string" && key in overrides) || key in target,
			get: (target, key) =>
				typeof key === "string" && key in overrides ? overrides[key] : Reflect.get(target, key),
		}),
	};
});

let store = createUserStoreDouble();
vi.doMock("~/app/models/user-store", () => ({ userStore: () => store }));

let seedReader = vi.fn(async () => 3);
vi.doMock("~/database/seed", async (original) => ({
	...(await original<typeof import("~/database/seed")>()),
	seedReader,
}));

let { default: devLogin } = await import("./dev-login");
let { default: home } = await import("./home");
let { SEED_USER } = await import("~/database/seed");

/** Turns the local switch on or off, as `.dev.vars` would. */
function setSwitch(value: string | undefined) {
	overrides = value === undefined ? {} : { DEV_LOGIN: value };
}

afterEach(() => setSwitch(undefined));

/**
 * A router carrying a real session and the app's session auth scheme, with a probe at `/me`
 * answering whoever that scheme resolved, so a test reads the sign-in back the way every
 * signed-in page does.
 */
function createSessionRouter() {
	let cookie = createCookie("reader:session", { secrets: ["test-secret"], path: "/" });
	let scheme = sessionScheme(
		{ renew: async () => null },
		{ verify: (auth: AuthSession) => ({ id: auth.idToken.subject, name: auth.idToken.name }) },
	);

	let router = createRouter({
		middleware: [
			asyncContext(),
			formData() as Middleware,
			session(cookie, createMemorySessionStorage()) as Middleware,
			auth({ schemes: [scheme] }) as Middleware,
			i18n,
			presentation,
			...documentRendering(),
		],
	});

	router.get("/me", (ctx) => {
		let state = ctx.get(Auth) as { ok: boolean; identity?: unknown };
		let stored = AuthSession.from(sessionOf(ctx));
		return Response.json({ auth: state.ok ? state.identity : null, expired: stored?.expired });
	});

	let app = router as unknown as AppRouter;
	app.map(routes.devLogin, devLogin);

	return app;
}

describe("/dev/login", () => {
	test("answers 404 when the switch is off, on a local host", async () => {
		let router = createSessionRouter();
		let page = await router.fetch(new Request("http://localhost:3006/dev/login"));
		let submit = await router.fetch(
			new Request("http://localhost:3006/dev/login", { method: "POST" }),
		);

		expect(page.status).toBe(404);
		expect(submit.status).toBe(404);
		expect(seedReader).not.toHaveBeenCalled();
	});

	test("answers 404 when the switch is on but the host is not this machine", async () => {
		setSwitch("true");
		let router = createSessionRouter();
		let page = await router.fetch(new Request("https://reader.sergiodxa.com/dev/login"));
		let submit = await router.fetch(
			new Request("https://reader.sergiodxa.com/dev/login", { method: "POST" }),
		);

		expect(page.status).toBe(404);
		expect(submit.status).toBe(404);
		expect(seedReader).not.toHaveBeenCalled();
	});

	test("leaves the header's link out unless both the switch and the host allow it", async () => {
		let router = createTestRouter(null);
		router.map(routes.home, home);
		let href = `href="${routes.devLogin.index.href()}"`;

		expect(await (await fetchRoute(router, "/")).text()).not.toContain(href);

		setSwitch("true");
		expect(await (await fetchRoute(router, "/")).text()).not.toContain(href);

		let local = await router.fetch(new Request("http://localhost:3006/"));
		expect(await local.text()).toContain(href);
	});

	test("signs in as the seed reader when the switch is on, on a local host", async () => {
		setSwitch("true");
		let router = createSessionRouter();

		let page = await router.fetch(new Request("http://localhost:3006/dev/login"));
		expect(page.status).toBe(200);
		expect(await page.text()).toContain(SEED_USER.email);

		let submit = await router.fetch(
			new Request("http://localhost:3006/dev/login", { method: "POST" }),
		);
		expect(submit.status).toBe(303);
		expect(submit.headers.get("Location")).toBe(routes.reading.index.href());
		expect(seedReader).toHaveBeenCalledOnce();

		let cookie = submit.headers
			.getSetCookie()
			.find((value) => value.startsWith("reader:session="))
			?.split(";")[0];
		expect(cookie).toBeDefined();

		let me = await router.fetch(
			new Request("http://localhost:3006/me", { headers: { Cookie: cookie ?? "" } }),
		);
		expect(await me.json()).toEqual({
			auth: { id: SEED_USER.subject, name: SEED_USER.name },
			expired: false,
		});
	});
});
