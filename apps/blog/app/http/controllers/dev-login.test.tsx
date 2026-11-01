/**
 * The development login, run behind the session, auth and access middleware the router uses:
 * it is absent unless `DEV_LOGIN=true` and the host is loopback, and when present it signs the
 * browser in as the seeded admin the CMS guard lets through, writing the seed content once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createKVNamespace } from "@sdxc/cloudflare-mocks";
import { models } from "@sdxc/data-model/router";
import { database } from "@sdxc/database-middleware";
import { lazy } from "@sdxc/lazy-route";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { AppContext } from "~/app/initializers/router";

import { DEV_ADMIN } from "~/config/dev-user";
import routes from "~/routes/web";

/** The `DEV_LOGIN` value the Worker reads, as `.dev.vars` would set it; unset by default. */
let devLoginFlag: string | undefined;

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();
	return {
		...original,
		env: new Proxy(original.env, {
			get: (target, property) =>
				property === "DEV_LOGIN" ? devLoginFlag : Reflect.get(target, property),
		}),
	};
});

let { default: auth } = await import("~/app/http/middleware/auth");
let { default: access } = await import("~/app/http/middleware/access");
let { default: createEnvMiddleware } = await import("~/app/http/middleware/env");
let { default: requireAdmin } = await import("~/app/http/middleware/require-admin");
let { default: requireDevLogin } = await import("~/app/http/middleware/require-dev-login");
let { loginController } = await import("~/app/http/controllers/auth");
let { default: registry } = await import("~/app/models");
let { testDatabase } = await import("~/app/test/database");
let { blankSearchFrame } = await import("~/app/test/frames");
let { bindModels } = await import("~/app/test/models");
let { pageRenderer } = await import("~/app/test/renderer");

/** The origin `bun dev` serves on. */
const LOCAL = "http://localhost:3011";

/** The bindings the app reads its secrets and caches out of. */
function createEnv(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "blog-client",
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
 * The dev login and the login screen behind the app's middleware, plus the dashboard path
 * answered by a stand-in behind the admin guard, so a 200 there means the CMS lets the session in.
 */
function createTestRouter(db: Database) {
	let router = createRouter<AppContext>({
		middleware: [
			createEnvMiddleware(createEnv()),
			log(createLogger({ service: "blog", sink: () => undefined })),
			asyncContext(),
			session(createCookie("blog-test", { secrets: ["test"] }), createMemorySessionStorage()),
			formData(),
			database(db),
			models(registry, (ctx) => ({ db: ctx.db })),
			auth,
			access,
			...pageRenderer(),
		],
	});

	router.map(routes.searchFrame, blankSearchFrame);
	router.map(routes.auth.login, loginController);
	router.map(
		routes.devLogin,
		lazy(() => import("~/app/http/controllers/dev-login"), [requireDevLogin]),
	);
	router.map(routes.cms.dashboard, {
		middleware: [requireAdmin],
		handler: () => new Response("cms"),
	});
	return router;
}

/** Fetches `path` on `origin` through the router, as a same-origin browser request. */
function fetchAt(
	router: ReturnType<typeof createTestRouter>,
	origin: string,
	path: string,
	init: RequestInit = {},
) {
	let headers = new Headers(init.headers);
	headers.set("Origin", origin);
	headers.set("Sec-Fetch-Site", "same-origin");
	return router.fetch(new Request(`${origin}${path}`, { ...init, headers, redirect: "manual" }));
}

afterEach(() => {
	devLoginFlag = undefined;
});

describe("the development login when it is off", () => {
	test.each([
		["the flag is unset", undefined, LOCAL],
		["the flag is not true", "1", LOCAL],
		["the host is not loopback", "true", "https://sergiodxa.com"],
	])("answers 404 and the login screen has no link when %s", async (_, flag, origin) => {
		devLoginFlag = flag;
		let router = createTestRouter(await testDatabase());

		let page = await fetchAt(router, origin, routes.devLogin.index.href());
		let submit = await fetchAt(router, origin, routes.devLogin.action.href(), { method: "POST" });
		let login = await fetchAt(router, origin, routes.auth.login.index.href());

		expect(page.status).toBe(404);
		expect(submit.status).toBe(404);
		expect(submit.headers.get("Set-Cookie")).toBeNull();
		expect(await login.text()).not.toContain(`href="${routes.devLogin.index.href()}"`);
	});
});

describe("the development login when it is on", () => {
	test("links from the login screen and names who the button signs in as", async () => {
		devLoginFlag = "true";
		let router = createTestRouter(await testDatabase());

		let page = await fetchAt(router, LOCAL, routes.devLogin.index.href());
		let login = await fetchAt(router, LOCAL, routes.auth.login.index.href());

		expect(page.status).toBe(200);
		expect(await login.text()).toContain(`href="${routes.devLogin.index.href()}"`);
		let body = await page.text();
		expect(body).toContain(DEV_ADMIN.email);
		expect(body).toContain(`action="${routes.devLogin.action.href()}"`);
	});

	test("signs in as the admin the CMS lets in, seeding content only the first time", async () => {
		devLoginFlag = "true";
		let db = await testDatabase();
		let router = createTestRouter(db);

		let submit = await fetchAt(router, LOCAL, routes.devLogin.action.href(), { method: "POST" });

		expect(submit.status).toBe(303);
		expect(submit.headers.get("Location")).toBe(routes.cms.dashboard.href());
		let cookie = submit.headers.get("Set-Cookie")?.split(";")[0] ?? "";
		let cms = await fetchAt(router, LOCAL, routes.cms.dashboard.href(), {
			headers: { Cookie: cookie },
		});
		expect(cms.status).toBe(200);

		let bound = bindModels(db);
		let admin = await bound.users.findBySubjectId(DEV_ADMIN.subjectId);
		expect(admin?.role).toBe("admin");
		let articles = await bound.articles.findAll({ includePreview: true });
		expect(articles.length).toBeGreaterThan(3);
		expect(await bound.webmentions.findByStatus("pending")).toHaveLength(2);

		await fetchAt(router, LOCAL, routes.devLogin.action.href(), { method: "POST" });
		expect(await bound.articles.findAll({ includePreview: true })).toHaveLength(articles.length);
	});
});
