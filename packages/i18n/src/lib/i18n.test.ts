/**
 * Covers `createI18n` against the behaviors every app relies on: the lookup chain through
 * regional locales and the fallback, missing keys echoed back, CLDR plural selection, raw
 * interpolation, per-bundle compiled-message caching, error reporting, and typed keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import type { Messages, Translate } from "./i18n.js";

import { createI18n } from "./i18n.js";

/** A plural message in MessageFormat 2 with `one` and `other` variants. */
const UNREAD =
	".input {$count :number}\n.match $count\none {{{$count} message}}\n* {{{$count} messages}}";

/** The fallback bundle, typed by its literal shape for the typed-key tests. */
const EN = {
	greeting: "Hello {$name}",
	onlyEnglish: "English only",
	nested: { deep: { key: "Deep" } },
	unread: UNREAD,
};

/** Bundles exercising every step of the lookup chain, untyped so any key is accepted. */
const RESOURCES: Readonly<Record<string, Messages>> = {
	en: EN,
	"en-US": { color: "color" },
	"en-GB": { color: "colour" },
	es: {
		greeting: "Hola {$name}",
		unread:
			".input {$count :number}\n.match $count\none {{{$count} mensaje}}\n* {{{$count} mensajes}}",
	},
	"es-MX": { onlyMexico: "Solo México" },
	fr: {
		unread:
			".input {$count :number}\n.match $count\none {{{$count} message}}\n* {{{$count} messages}}",
	},
	ja: { unread: ".input {$count :number}\n.match $count\n* {{{$count}件のメッセージ}}" },
};

/** Builds a translator over {@link RESOURCES} with `en` as the fallback. */
function make(locale: string, onError?: (error: Error, key: string) => void) {
	return createI18n({ locale, fallbackLanguage: "en", resources: RESOURCES, onError });
}

describe("lookup chain", () => {
	test("resolves the locale's own bundle first", () => {
		expect(make("en-GB").t("color")).toBe("colour");
		expect(make("es-MX").t("onlyMexico")).toBe("Solo México");
	});

	test("falls through to the primary subtag, then the fallback", () => {
		let mexico = make("es-MX");
		expect(mexico.t("greeting", { name: "Ada" })).toBe("Hola Ada");
		expect(mexico.t("onlyEnglish")).toBe("English only");
		expect(make("en-US").t("greeting", { name: "Ada" })).toBe("Hello Ada");
	});

	test("skips languages with no bundle", () => {
		expect(make("de-AT").t("greeting", { name: "Ada" })).toBe("Hello Ada");
	});

	test("walks dotted keys through nested objects", () => {
		expect(make("en").t("nested.deep.key")).toBe("Deep");
	});

	test("resolves a regional fallback through its primary subtag", () => {
		let i18n = createI18n({ locale: "de", fallbackLanguage: "en-AU", resources: RESOURCES });
		expect(i18n.t("onlyEnglish")).toBe("English only");
	});

	test("reports the requested locale", () => {
		expect(make("es-MX").locale).toBe("es-MX");
	});
});

describe("missing keys", () => {
	test("return the key itself", () => {
		expect(make("es").t("does.not.exist")).toBe("does.not.exist");
	});

	test("an object in place of a string counts as missing", () => {
		expect(make("en").t("nested.deep")).toBe("nested.deep");
	});

	test("parts yield one text part with the key", () => {
		expect(make("en").parts("nope")).toEqual([{ type: "text", value: "nope" }]);
	});
});

describe("plurals", () => {
	test.each([
		["en", 1, "1 message"],
		["en", 0, "0 messages"],
		["en", 1200, "1,200 messages"],
		["es", 1, "1 mensaje"],
		["es", 5, "5 mensajes"],
		["fr", 0, "0 message"],
		["fr", 1, "1 message"],
		["fr", 2, "2 messages"],
		["ja", 1, "1件のメッセージ"],
		["ja", 7, "7件のメッセージ"],
	])("%s with count %d formats as %s", (locale, count, expected) => {
		expect(make(locale).t("unread", { count })).toBe(expected);
	});
});

describe("interpolation", () => {
	test("inserts values raw, leaving escaping to the renderer", () => {
		expect(make("en").t("greeting", { name: "<b>A&B</b>" })).toBe("Hello <b>A&B</b>");
	});

	test("shows a missing variable as its fallback and reports it with the key", () => {
		let errors: string[] = [];
		let output = make("en", (_, key) => errors.push(key)).t("greeting");
		expect(output).toBe("Hello {$name}");
		expect(errors).toEqual(["greeting"]);
	});
});

describe("compilation", () => {
	test("a message that fails to compile renders its key and reports the error", () => {
		let errors: Array<[string, string]> = [];
		let i18n = createI18n({
			locale: "en",
			fallbackLanguage: "en",
			resources: { en: { broken: "Hello {$name" } },
			onError: (error, key) => errors.push([error.name, key]),
		});
		expect(i18n.t("broken")).toBe("broken");
		expect(i18n.parts("broken")).toEqual([{ type: "text", value: "broken" }]);
		expect(errors.map(([, key]) => key)).toEqual(["broken", "broken"]);
	});

	test("keeps compiled messages per resources object", () => {
		let first = createI18n({
			locale: "en",
			fallbackLanguage: "en",
			resources: { en: { a: "one" } },
		});
		let second = createI18n({
			locale: "en",
			fallbackLanguage: "en",
			resources: { en: { a: "two" } },
		});
		expect(first.t("a")).toBe("one");
		expect(second.t("a")).toBe("two");
	});

	test("caches per language, so two locales sharing a key keep their own copy", () => {
		expect(make("es").t("greeting", { name: "A" })).toBe("Hola A");
		expect(make("en").t("greeting", { name: "A" })).toBe("Hello A");
	});
});

describe("markup parts", () => {
	test("keeps markup as parts for the caller to render", () => {
		let i18n = createI18n({
			locale: "en",
			fallbackLanguage: "en",
			resources: { en: { read: "Read {#link}{$title}{/link}" } },
		});
		expect(i18n.parts("read", { title: "Post" })).toMatchObject([
			{ type: "text", value: "Read " },
			{ type: "markup", kind: "open", name: "link" },
			{ type: "string", value: "Post" },
			{ type: "markup", kind: "close", name: "link" },
		]);
		expect(i18n.t("read", { title: "Post" })).toBe("Read Post");
	});
});

describe("typed keys", () => {
	test("derives dotted keys from the fallback bundle", () => {
		let i18n = createI18n({
			locale: "es",
			fallbackLanguage: "en",
			resources: { en: EN, es: { greeting: "Hola {$name}" } },
		});
		expectTypeOf(i18n.t)
			.parameter(0)
			.toEqualTypeOf<"greeting" | "onlyEnglish" | "nested.deep.key" | "unread">();
		// @ts-expect-error -- a typo is not a key of the bundle
		i18n.t("nested.deep.kye");
	});

	test("untyped bundles accept any key", () => {
		expectTypeOf<Translate>().parameter(0).toEqualTypeOf<string>();
		expectTypeOf<Translate<Messages>>().toEqualTypeOf<Translate>();
	});
});
