/**
 * Covers the i18n middleware: publication of the detected locale and a translator on the
 * request context, fallback-language resolution from the detection config, session reuse from
 * an upstream session middleware, per-request isolation, and error logging.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RequestContext } from "remix/router";
import { createSession, Session } from "remix/session";
import { describe, expect, test, vi } from "vitest";

import i18n from "./middleware.js";

/** Bundles with a key shared across languages and one English-only key. */
const RESOURCES = {
	en: { hello: "Hello", onlyEnglish: "English only", greet: "Hi {$name}" },
	es: { hello: "Hola" },
};

/** Builds a request context for the given path and headers. */
function makeContext(path = "/", headers: Record<string, string> = {}): RequestContext {
	return new RequestContext(new Request(new URL(path, "https://example.com"), { headers }));
}

/** A `next` that records it ran and returns a sentinel response. */
function passthroughNext() {
	return vi.fn(async () => new Response("ok", { status: 200 }));
}

describe("i18n middleware", () => {
	test("publishes the detected locale and a translator on the context", async () => {
		let middleware = i18n({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			resources: RESOURCES,
		});

		let context = makeContext("/?lng=es");
		let next = passthroughNext();

		let response = await middleware(context, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
		expect(context.locale).toBe("es");
		expect(context.intl.locale).toBe("es");
		expect(context.intl.t("hello")).toBe("Hola");
	});

	test("resolves missing keys through the detection fallback language", async () => {
		let middleware = i18n({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			resources: RESOURCES,
		});

		let context = makeContext("/?lng=es");
		await middleware(context, passthroughNext());

		expect(context.intl.t("onlyEnglish")).toBe("English only");
	});

	test("reuses the session installed by an upstream session middleware", async () => {
		let middleware = i18n({
			detection: { supportedLanguages: ["en", "es", "fr"], fallbackLanguage: "en" },
			resources: RESOURCES,
		});

		let session = createSession();
		session.set("lng", "fr");

		let context = makeContext();
		context.set(Session, session, { property: "session" });

		await middleware(context, passthroughNext());

		expect(context.locale).toBe("fr");
		expect(context.intl.t("hello")).toBe("Hello");
	});

	test("each request gets its own translator", async () => {
		let middleware = i18n({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			resources: RESOURCES,
		});

		let spanish = makeContext("/", { "Accept-Language": "es" });
		let english = makeContext("/", { "Accept-Language": "en" });

		await Promise.all([
			middleware(spanish, passthroughNext()),
			middleware(english, passthroughNext()),
		]);

		expect(spanish.intl).not.toBe(english.intl);
		expect(spanish.intl.t("hello")).toBe("Hola");
		expect(english.intl.t("hello")).toBe("Hello");
	});

	test("renders a message error as its fallback text without throwing", async () => {
		let middleware = i18n({
			detection: { supportedLanguages: ["en"], fallbackLanguage: "en" },
			resources: RESOURCES,
		});

		let context = makeContext();
		await middleware(context, passthroughNext());

		expect(context.intl.t("greet")).toBe("Hi {$name}");
	});

	test("returns the downstream response unchanged", async () => {
		let middleware = i18n({
			detection: { supportedLanguages: ["en"], fallbackLanguage: "en" },
			resources: RESOURCES,
		});

		let context = makeContext();
		let sentinel = new Response("downstream", { status: 418 });

		let response = await middleware(context, async () => sentinel);

		expect(response).toBe(sentinel);
	});
});
