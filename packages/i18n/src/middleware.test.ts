import { describe, expect, mock, test } from "bun:test";

/**
 * Covers the i18next middleware: locale + per-request instance publication on
 * the request context, translation through inline resources and backend
 * plugins, fallback-language defaults derived from the detection config,
 * session reuse from an upstream session middleware, per-request isolation of
 * the i18next instances, and the narrowing of inline resources to the bundles
 * the detected language can actually resolve through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BackendModule } from "i18next";

import { RequestContext } from "remix/router";
import { createSession, Session } from "remix/session";

import i18next from "./middleware";

/** Inline resources with a key shared across languages and one English-only key. */
const RESOURCES = {
	en: { translation: { hello: "Hello", onlyEnglish: "English only" } },
	es: { translation: { hello: "Hola" } },
};

/** Inline resources for three languages, to check which bundles get attached. */
const MULTILINGUAL_RESOURCES = {
	en: { translation: { hello: "Hello", onlyEnglish: "English only" } },
	es: { translation: { hello: "Hola" } },
	fr: { translation: { hello: "Bonjour" } },
};

/** Builds a request context for the given path and headers. */
function makeContext(path = "/", headers: Record<string, string> = {}): RequestContext {
	return new RequestContext(new Request(new URL(path, "https://example.com"), { headers }));
}

/** A `next` that records it ran and returns a sentinel response. */
function passthroughNext() {
	return mock(async () => new Response("ok", { status: 200 }));
}

describe("i18next middleware", () => {
	test("publishes the detected locale and a translating instance on the context", async () => {
		let middleware = i18next({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			i18next: { resources: RESOURCES },
		});

		let context = makeContext("/?lng=es");
		let next = passthroughNext();

		let response = await middleware(context, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
		expect(context.locale).toBe("es");
		expect(context.i18next.language).toBe("es");
		expect(context.i18next.t("hello")).toBe("Hola");
	});

	test("defaults fallbackLng from the detection config", async () => {
		let middleware = i18next({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			i18next: { resources: RESOURCES },
		});

		let context = makeContext("/?lng=es");
		await middleware(context, passthroughNext());

		// The key only exists in English, so resolving it proves the fallback chain
		expect(context.i18next.t("onlyEnglish")).toBe("English only");
	});

	test("reuses the session installed by an upstream session middleware", async () => {
		let middleware = i18next({
			detection: { supportedLanguages: ["en", "es", "fr"], fallbackLanguage: "en" },
			i18next: { resources: RESOURCES },
		});

		let session = createSession();
		session.set("lng", "fr");

		let context = makeContext();
		context.set(Session, session, { property: "session" });

		await middleware(context, passthroughNext());

		expect(context.locale).toBe("fr");
	});

	test("loads translations through a backend plugin", async () => {
		let backend: BackendModule = {
			type: "backend",
			init() {},
			read(language, namespace, callback) {
				callback(null, { greeting: `${language}:${namespace}` });
			},
		};

		let middleware = i18next({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			plugins: [backend],
		});

		let context = makeContext("/?lng=es");
		await middleware(context, passthroughNext());

		expect(context.i18next.t("greeting")).toBe("es:translation");
	});

	test("each request gets its own isolated instance", async () => {
		let middleware = i18next({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			i18next: { resources: RESOURCES },
		});

		let spanish = makeContext("/", { "Accept-Language": "es" });
		let english = makeContext("/", { "Accept-Language": "en" });

		await Promise.all([
			middleware(spanish, passthroughNext()),
			middleware(english, passthroughNext()),
		]);

		expect(spanish.i18next).not.toBe(english.i18next);
		expect(spanish.i18next.t("hello")).toBe("Hola");
		expect(english.i18next.t("hello")).toBe("Hello");
	});

	test("loads translations through an async backend plugin before handlers run", async () => {
		let backend: BackendModule = {
			type: "backend",
			init() {},
			read(language, namespace, callback) {
				setTimeout(() => callback(null, { greeting: `${language}:${namespace}` }), 5);
			},
		};

		let middleware = i18next({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			plugins: [backend],
		});

		let context = makeContext("/?lng=es");
		await middleware(context, passthroughNext());

		// Initialization awaits the initial namespace load, so a backend that answers
		// asynchronously has still populated the store by the time a handler runs.
		expect(context.i18next.t("greeting")).toBe("es:translation");
	});

	test("attaches only the request's language and the fallback to the resource store", async () => {
		let middleware = i18next({
			detection: { supportedLanguages: ["en", "es", "fr"], fallbackLanguage: "en" },
			i18next: { resources: MULTILINGUAL_RESOURCES },
		});

		let context = makeContext("/?lng=es");
		await middleware(context, passthroughNext());

		// Only the detected language and the fallback are attached; every other
		// supported language's bundle stays out of this request's resource store.
		expect(context.i18next.hasResourceBundle("es", "translation")).toBe(true);
		expect(context.i18next.hasResourceBundle("en", "translation")).toBe(true);
		expect(context.i18next.hasResourceBundle("fr", "translation")).toBe(false);

		// Dropping the other bundles must not cost the fallback chain: a key the
		// detected language is missing still resolves through the fallback.
		expect(context.i18next.t("hello")).toBe("Hola");
		expect(context.i18next.t("onlyEnglish")).toBe("English only");
	});

	test("returns the downstream response unchanged", async () => {
		let middleware = i18next({
			detection: { supportedLanguages: ["en"], fallbackLanguage: "en" },
			i18next: { resources: RESOURCES },
		});

		let context = makeContext();
		let sentinel = new Response("downstream", { status: 418 });

		let response = await middleware(context, async () => sentinel);

		expect(response).toBe(sentinel);
	});
});
