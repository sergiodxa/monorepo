/**
 * Covers the request-less translator factory: fallback defaults, resolution of a
 * language the caller does not ship, the reported locale being the one copy was
 * produced in, per-language instance caching (including the unsupported language
 * sharing the fallback's instance), cache ownership per translator, and the
 * i18next options a caller passes through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createTranslator } from "./translator";

/** Bundles for three languages, with one key present in every one of them. */
const RESOURCES = {
	en: { translation: { hello: "Hello", name: "Hi {{name}}" } },
	es: { translation: { hello: "Hola", name: "Hola {{name}}" } },
	fr: { translation: { hello: "Bonjour" } },
};

/** The languages {@link RESOURCES} ships, as a translator is configured with them. */
const SUPPORTED_LANGUAGES = ["en", "es", "fr"];

/** Builds a translator over {@link RESOURCES}, optionally with extra i18next options. */
function makeTranslator(i18next?: { interpolation: { escapeValue: boolean } }) {
	return createTranslator({
		resources: RESOURCES,
		supportedLanguages: SUPPORTED_LANGUAGES,
		fallbackLanguage: "en",
		i18next,
	});
}

describe("createTranslator", () => {
	test("defaults to the fallback language when asked for none", async () => {
		let { locale, t } = await makeTranslator()();

		expect(locale).toBe("en");
		expect(t("hello")).toBe("Hello");
	});

	test("translates through a supported language and reports it", async () => {
		let { locale, t } = await makeTranslator()("es");

		expect(locale).toBe("es");
		expect(t("hello")).toBe("Hola");
	});

	test("resolves an unsupported language to the fallback, and says so", async () => {
		let { locale, t } = await makeTranslator()("xx");

		expect(locale).toBe("en");
		expect(t("hello")).toBe("Hello");
	});

	test("falls back per key for a language missing one", async () => {
		let { locale, t } = await makeTranslator()("fr");

		expect(locale).toBe("fr");
		expect(t("hello")).toBe("Bonjour");
		expect(t("name", { name: "Ada" })).toBe("Hi Ada");
	});

	test("reuses one instance per language instead of initializing again", async () => {
		let translate = makeTranslator();

		let first = await translate("es");
		let second = await translate("es");

		expect(second.i18n).toBe(first.i18n);
		expect(second.t).toBe(first.t);
	});

	test("shares the fallback's instance with every unsupported language", async () => {
		let translate = makeTranslator();

		let fallback = await translate();
		let unsupported = await translate("xx");

		expect(unsupported.i18n).toBe(fallback.i18n);
	});

	test("builds a separate instance per language", async () => {
		let translate = makeTranslator();

		let english = await translate("en");
		let spanish = await translate("es");

		expect(spanish.i18n).not.toBe(english.i18n);
		expect(english.i18n.language).toBe("en");
		expect(spanish.i18n.language).toBe("es");
	});

	test("keeps each translator's cache to itself", async () => {
		let first = await makeTranslator()("es");
		let second = await makeTranslator()("es");

		expect(second.i18n).not.toBe(first.i18n);
	});

	test("exposes the instance every supported language can be translated through", async () => {
		let { i18n } = await makeTranslator()("es");

		expect(i18n.getFixedT("fr")("hello")).toBe("Bonjour");
	});

	test("passes the caller's i18next options through to every instance", async () => {
		let escaping = await makeTranslator({ interpolation: { escapeValue: true } })("en");
		let raw = await makeTranslator({ interpolation: { escapeValue: false } })("en");

		expect(escaping.t("name", { name: "A&B" })).toBe("Hi A&amp;B");
		expect(raw.t("name", { name: "A&B" })).toBe("Hi A&B");
	});
});
