/**
 * Covers the request-less translator factory: fallback defaults, resolving a language absent
 * from the caller's resources, the reported locale matching where copy was produced,
 * per-language caching (the unsupported language sharing the fallback's), cache ownership per
 * translator, and error reporting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { createTranslator } from "./translator.js";

/** Bundles for three languages, with one key present in every one of them. */
const RESOURCES = {
	en: { hello: "Hello", name: "Hi {$name}" },
	es: { hello: "Hola", name: "Hola {$name}" },
	fr: { hello: "Bonjour" },
};

const SUPPORTED_LANGUAGES = ["en", "es", "fr"];

function makeTranslator(onError?: (error: Error, key: string) => void) {
	return createTranslator({
		resources: RESOURCES,
		supportedLanguages: SUPPORTED_LANGUAGES,
		fallbackLanguage: "en",
		onError,
	});
}

describe("createTranslator", () => {
	test("defaults to the fallback language when asked for none", () => {
		let { locale, t } = makeTranslator()();

		expect(locale).toBe("en");
		expect(t("hello")).toBe("Hello");
	});

	test("translates through a supported language and reports it", () => {
		let { locale, t, intl } = makeTranslator()("es");

		expect(locale).toBe("es");
		expect(intl.locale).toBe("es");
		expect(t("hello")).toBe("Hola");
	});

	test("resolves an unsupported language to the fallback, and says so", () => {
		let { locale, t } = makeTranslator()("xx");

		expect(locale).toBe("en");
		expect(t("hello")).toBe("Hello");
	});

	test("falls back per key for a language missing one", () => {
		let { locale, t } = makeTranslator()("fr");

		expect(locale).toBe("fr");
		expect(t("hello")).toBe("Bonjour");
		expect(t("name", { name: "Ada" })).toBe("Hi Ada");
	});

	test("reuses one translation per language", () => {
		let translate = makeTranslator();

		let first = translate("es");
		let second = translate("es");

		expect(second.intl).toBe(first.intl);
		expect(second.t).toBe(first.t);
	});

	test("shares the fallback's translation with every unsupported language", () => {
		let translate = makeTranslator();

		expect(translate("xx").intl).toBe(translate().intl);
	});

	test("keeps each translator's cache to itself", () => {
		let first = makeTranslator()("es");
		let second = makeTranslator()("es");

		expect(second.intl).not.toBe(first.intl);
	});

	test("reports message errors through onError", () => {
		let keys: string[] = [];
		let { t } = makeTranslator((_, key) => keys.push(key))("en");

		expect(t("name")).toBe("Hi {$name}");
		expect(keys).toEqual(["name"]);
	});
});
