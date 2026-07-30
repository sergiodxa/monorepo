/**
 * Integration tests for the language-resolution middleware. `@pkg/i18n/middleware`'s
 * generic cookie/header detection is covered by that package's own tests; these
 * focus on this file's app-specific configuration — the `language` cookie takes
 * priority over the `Accept-Language` header, falling back to English — using the
 * real session + auth chain to resolve the viewer (resolution is identical for a
 * signed-in viewer and an anonymous request, since neither queries the database).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { session } from "remix/session-middleware";
import { createMemorySessionStorage } from "remix/session-storage/memory";

import { language } from "~/app/http/cookies";
import { auth, login, type Viewer } from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";

type Db = ReturnType<typeof createTestDatabase>["db"];

let viewer: Viewer = { id: "user_1", name: "Ada", email: "ada@example.com", avatar: "" };

async function dispatch(db: Db, options: { viewer?: Viewer; headers?: HeadersInit } = {}) {
	let cookie = createCookie("test-session", { secrets: ["test-secret"] });
	let storage = createMemorySessionStorage();

	let router = createRouter({
		middleware: [
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				if (options.viewer) login(options.viewer);
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

	test("falls back to the Accept-Language header when the viewer has no language cookie", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, { viewer, headers: { "Accept-Language": "fr" } });

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("fr");
	});

	test("uses the Accept-Language header for an anonymous request without touching the database", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, { headers: { "Accept-Language": "de" } });

		let body = (await response.json()) as { locale: string };
		expect(body.locale).toBe("de");
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
