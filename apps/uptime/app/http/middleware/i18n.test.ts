/**
 * Integration tests for the language-resolution middleware: the `language`
 * cookie first, then a signed-in viewer's stored preference, then
 * `Accept-Language`, falling back to English, resolved through the real
 * session + auth chain. Every case also pins the database call count, since
 * a cookie hit resolving the language without a query is the property under test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@pkg/service-container";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test } from "vitest";

import UserPreferences from "~/app/data/user-preferences";
import { language } from "~/app/http/cookies";
import { auth, type Viewer } from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import { signIn } from "~/app/lib/test/auth";
import { createTestDatabase } from "~/app/lib/test/db";

type Db = ReturnType<typeof createTestDatabase>["db"];

let viewer: Viewer = { id: "user_1", name: "Ada", email: "ada@example.com", avatar: "" };

/**
 * Wraps a database so every call through it is counted, which is how the
 * zero-query claims below are checked. Counting happens at the handle, so a
 * query added anywhere on the request path is caught here.
 */
function counting(db: Db) {
	let calls = { count: 0 };

	let counted = new Proxy(db, {
		get(target, property) {
			let value = Reflect.get(target, property) as unknown;
			if (typeof value !== "function") return value;

			return (...args: unknown[]) => {
				calls.count += 1;
				return (value as (...args: unknown[]) => unknown).apply(target, args);
			};
		},
	}) as Db;

	return { db: counted, calls };
}

async function dispatch(db: Db, options: { viewer?: Viewer; headers?: HeadersInit } = {}) {
	let cookie = createCookie("test-session", { secrets: ["test-secret"] });
	let storage = createMemorySessionStorage();

	let router = createRouter({
		middleware: [
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				if (options.viewer) signIn(options.viewer);
				return next();
			},
			auth,
			i18n,
		],
	});

	router.get("/", (ctx) => Response.json({ locale: ctx.locale }));

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let request = new Request("https://example.com/", { headers: options.headers });
	return container.scope(() => router.fetch(request));
}

/** The `language` cookie the response asks the browser to store, if it asks for one. */
function languageCookieHeader(response: Response) {
	return response.headers.getSetCookie().find((value) => value.startsWith("uptime:language="));
}

describe("i18n middleware", () => {
	test("prefers the language cookie over the Accept-Language header for a signed-in viewer", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, {
			viewer,
			headers: { "Accept-Language": "fr", Cookie: await language.serialize("es") },
		});

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("es");
	});

	test("uses the Accept-Language header for an anonymous request without touching the database", async () => {
		let { db: raw } = createTestDatabase();
		let { db, calls } = counting(raw);

		let response = await dispatch(db, { headers: { "Accept-Language": "de" } });

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("de");
		expect(calls.count).toBe(0);
		expect(languageCookieHeader(response)).toBeUndefined();
	});

	test("keeps the cookie's language over a conflicting stored preference, without a query", async () => {
		let { db: raw } = createTestDatabase();
		await UserPreferences.setLanguage(raw, viewer.id, "es");

		let { db, calls } = counting(raw);
		let response = await dispatch(db, {
			viewer,
			headers: { "Accept-Language": "fr", Cookie: await language.serialize("ja") },
		});

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("ja");
		expect(calls.count).toBe(0);
		expect(languageCookieHeader(response)).toBeUndefined();
	});

	test("resolves from the stored preference and re-sets the cookie when the cookie is gone", async () => {
		let { db } = createTestDatabase();
		await UserPreferences.setLanguage(db, viewer.id, "es");

		let response = await dispatch(db, { viewer, headers: { "Accept-Language": "fr" } });

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("es");
		expect(languageCookieHeader(response)).toBe(await language.serialize("es"));
	});

	test("falls back to the Accept-Language header, setting no cookie, when nothing is stored", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, { viewer, headers: { "Accept-Language": "fr" } });

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("fr");
		expect(languageCookieHeader(response)).toBeUndefined();
	});

	test("ignores a stored language the app no longer supports", async () => {
		let { db } = createTestDatabase();
		let { userPreferences } = await import("~/database/schema");
		await db.create(
			userPreferences,
			{
				id: crypto.randomUUID(),
				subject_id: viewer.id,
				preferred_language: "pt" as never,
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(db, { viewer, headers: { "Accept-Language": "fr" } });

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("fr");
		expect(languageCookieHeader(response)).toBeUndefined();
	});

	test("uses the language cookie for an anonymous request when no header is sent", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, { headers: { Cookie: await language.serialize("ja") } });

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("ja");
	});

	test("falls back to English when nothing matches", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, {});

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("en");
	});
});
