/**
 * The development login, run through the app's router with the real auth middleware: it is
 * absent unless `DEV_LOGIN=true` and the host is loopback, and when present it signs the
 * browser in as the seeded user the next request resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";
import { DEV_TEAM, DEV_USER } from "~/config/dev-user";
import routes from "~/routes/web";

let { db } = createTestDatabase();

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

vi.doMock("~/app/http/middleware/session", () => ({
	createSessionMiddleware: () =>
		session(createCookie("uptime-test", { secrets: ["test"] }), createMemorySessionStorage()),
}));
vi.doMock("~/app/initializers/database", () => ({ openDatabase: () => db }));

let { env } = await import("cloudflare:workers");
let { createWebRouter } = await import("~/app/initializers/router");
let router = createWebRouter({ kv: env.KV, cookieSecret: "test", secure: false });

/** The origin `bun dev` serves on. */
const LOCAL = "http://localhost:5173";

/** Sets the `DEV_LOGIN` flag the way `.dev.vars` would, or leaves it unset. */
function setFlag(value: string | undefined) {
	devLoginFlag = value;
}

/** Fetches `path` on `origin` through the router, as a same-origin browser request. */
function fetchAt(origin: string, path: string, init: RequestInit = {}) {
	let headers = new Headers(init.headers);
	headers.set("Origin", origin);
	headers.set("Sec-Fetch-Site", "same-origin");
	return router.fetch(new Request(`${origin}${path}`, { ...init, headers }));
}

afterEach(() => setFlag(undefined));

describe("dev login when it is off", () => {
	test.each([
		["the flag is unset", undefined, LOCAL],
		["the flag is not true", "1", LOCAL],
		["the host is not loopback", "true", "https://uptime.sergiodxa.com"],
	])("answers 404 and the home page has no link when %s", async (_, flag, origin) => {
		setFlag(flag);

		let page = await fetchAt(origin, routes.devLogin.index.href());
		let submit = await fetchAt(origin, routes.devLogin.action.href(), { method: "POST" });
		let home = await fetchAt(origin, `${routes.home.href()}?case=${flag}-${origin}`);

		expect(page.status).toBe(404);
		expect(submit.status).toBe(404);
		expect(submit.headers.get("Set-Cookie")).toBeNull();
		expect(await home.text()).not.toContain(`href="${routes.devLogin.index.href()}"`);
	});
});

describe("dev login when it is on", () => {
	test("links from the home page and shows who the button signs in as", async () => {
		setFlag("true");

		let page = await fetchAt(LOCAL, routes.devLogin.index.href());
		let home = await fetchAt(LOCAL, `${routes.home.href()}?case=on`);

		expect(page.status).toBe(200);
		expect(await home.text()).toContain(`href="${routes.devLogin.index.href()}"`);
		let body = await page.text();
		expect(body).toContain(DEV_USER.email);
		expect(body).toContain(`action="${routes.devLogin.action.href()}"`);
	});

	test("signs in as the seeded user, whose team the app then opens", async () => {
		setFlag("true");
		let team = await bindModels(db).teams.create({
			owner_id: DEV_USER.id,
			name: DEV_TEAM.name,
			slug: DEV_TEAM.slug,
			logo: null,
		});
		expect(team.status).toBe("success");

		let submit = await fetchAt(LOCAL, routes.devLogin.action.href(), { method: "POST" });

		expect(submit.status).toBe(303);
		expect(submit.headers.get("Location")).toBe(routes.app.index.href());
		let cookie = submit.headers.get("Set-Cookie")?.split(";")[0] ?? "";
		expect(cookie).not.toBe("");

		let app = await fetchAt(LOCAL, routes.app.index.href(), { headers: { Cookie: cookie } });

		expect(app.status).toBe(303);
		expect(app.headers.get("Location")).toContain(DEV_TEAM.slug);
	});
});
