/**
 * Covers server-side language detection across every method: search params,
 * cookie, session (live session and storage-backed), Accept-Language header,
 * and custom lookups — plus order overrides, loose matching, skipping of
 * unconfigured methods, and the guaranteed fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Session, SessionStorage } from "remix/session";

import { createCookie } from "remix/cookie";
import { createSession } from "remix/session";
import { describe, expect, test } from "vitest";

import { LanguageDetector } from "./language-detector.js";

function makeRequest(path = "/", headers: Record<string, string> = {}): Request {
	return new Request(new URL(path, "https://example.com"), { headers });
}

function makeSessionStorage(): SessionStorage {
	let sessions = new Map<string, Session>();
	return {
		async read(cookie) {
			if (cookie) {
				let session = sessions.get(cookie);
				if (session) return session;
			}
			return createSession();
		},
		async save(session) {
			sessions.set(session.id, session);
			return session.id;
		},
	};
}

describe(LanguageDetector, () => {
	test("detects the language from search params", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
		});

		await expect(detector.detect(makeRequest("/?lng=es"))).resolves.toBe("es");
	});

	test("supports a custom search parameter name", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
			searchParamKey: "locale",
		});

		await expect(detector.detect(makeRequest("/?locale=es"))).resolves.toBe("es");
	});

	test("detects the language from a cookie", async () => {
		let cookie = createCookie("lng");
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
			cookie,
		});

		let request = makeRequest("/", { Cookie: await cookie.serialize("es") });

		await expect(detector.detect(request)).resolves.toBe("es");
	});

	test("detects the language from a live session", async () => {
		let session = createSession();
		session.set("lng", "es");

		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
		});

		await expect(detector.detect(makeRequest(), session)).resolves.toBe("es");
	});

	test("detects the language from session storage via the session cookie", async () => {
		let sessionCookie = createCookie("session");
		let sessionStorage = makeSessionStorage();

		let session = createSession();
		session.set("lng", "es");
		let cookieValue = await sessionStorage.save(session);
		if (!cookieValue) throw new Error("expected a session cookie value");

		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
			sessionCookie,
			sessionStorage,
		});

		let request = makeRequest("/", { Cookie: await sessionCookie.serialize(cookieValue) });

		await expect(detector.detect(request)).resolves.toBe("es");
	});

	test("supports a custom session key", async () => {
		let session = createSession();
		session.set("language", "es");

		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
			sessionKey: "language",
		});

		await expect(detector.detect(makeRequest(), session)).resolves.toBe("es");
	});

	test("detects the language from the Accept-Language header", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
		});

		let request = makeRequest("/", { "Accept-Language": "es;q=0.9,en;q=0.8" });

		await expect(detector.detect(request)).resolves.toBe("es");
	});

	test("header detection honors quality across unsupported ranges", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["es"],
			fallbackLanguage: "en",
		});

		let request = makeRequest("/", { "Accept-Language": "fr;q=1,es;q=0.5" });

		await expect(detector.detect(request)).resolves.toBe("es");
	});

	test("falls back to a loose match on the primary language code", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["es-ES"],
			fallbackLanguage: "en",
		});

		await expect(detector.detect(makeRequest("/?lng=es-MX"))).resolves.toBe("es-ES");
	});

	test("detects the language with a custom findLocale lookup", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
			async findLocale(request) {
				return new URL(request.url).pathname.split("/").at(1) ?? null;
			},
		});

		await expect(detector.detect(makeRequest("/es/dashboard"))).resolves.toBe("es");
	});

	test("earlier methods win over later ones", async () => {
		let cookie = createCookie("lng");
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es", "fr"],
			fallbackLanguage: "en",
			cookie,
		});

		let request = makeRequest("/?lng=fr", {
			"Accept-Language": "en",
			Cookie: await cookie.serialize("es"),
		});

		await expect(detector.detect(request)).resolves.toBe("fr");
	});

	test("a custom order restricts and reorders the methods", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es", "fr"],
			fallbackLanguage: "en",
			order: ["header"],
		});

		let request = makeRequest("/?lng=fr", { "Accept-Language": "es" });

		await expect(detector.detect(request)).resolves.toBe("es");
	});

	test("skips methods missing their required options", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
			order: ["cookie", "session", "custom"],
		});

		await expect(detector.detect(makeRequest("/?lng=es"))).resolves.toBe("en");
	});

	test("ignores unsupported detected values and falls back", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "en",
		});

		await expect(detector.detect(makeRequest("/?lng=ja"))).resolves.toBe("en");
	});

	test("returns the fallback language when nothing is detected", async () => {
		let detector = new LanguageDetector({
			supportedLanguages: ["en", "es"],
			fallbackLanguage: "es",
		});

		await expect(detector.detect(makeRequest())).resolves.toBe("es");
	});
});
