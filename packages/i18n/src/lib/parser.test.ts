/**
 * Covers Accept-Language parsing (RFC 9110 weights, script/region subtags,
 * malformed input tolerance), the RFC 4647 Lookup fallback pattern, and
 * supported-language matching in Lookup and loose modes, including q=0 ranges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { formatLanguageString, lookupFallbacks, parse, pick } from "./parser.js";

describe(parse, () => {
	test("parses a single language", () => {
		expect(parse("en")).toEqual([
			{ tag: "en", code: "en", script: null, region: undefined, quality: 1 },
		]);
	});

	test("parses a language with a region", () => {
		expect(parse("en-US")).toEqual([
			{ tag: "en-US", code: "en", script: null, region: "US", quality: 1 },
		]);
	});

	test("parses a language with script and region", () => {
		expect(parse("zh-Hant-TW")).toEqual([
			{ tag: "zh-Hant-TW", code: "zh", script: "Hant", region: "TW", quality: 1 },
		]);
	});

	test("sorts languages by descending quality", () => {
		let languages = parse("en;q=0.8,es;q=0.9,fr;q=0.7");
		expect(languages.map((language) => language.code)).toEqual(["es", "en", "fr"]);
	});

	test("defaults quality to 1.0 when omitted", () => {
		let languages = parse("en;q=0.5,es");
		expect(languages[0]?.code).toBe("es");
		expect(languages[0]?.quality).toBe(1);
	});

	test("parses the wildcard range", () => {
		expect(parse("*")).toEqual([
			{ tag: "*", code: "*", script: null, region: undefined, quality: 1 },
		]);
	});

	test("returns an empty list for empty or garbage input", () => {
		expect(parse()).toEqual([]);
		expect(parse("")).toEqual([]);
		expect(parse("!!!")).toEqual([]);
	});

	test("trims the space around each range and skips a malformed one", () => {
		let languages = parse(" es-MX , fr;q=0.8 ,!!, de;q=0.9 ");
		expect(languages.map((language) => [language.code, language.quality])).toEqual([
			["es", 1],
			["de", 0.9],
			["fr", 0.8],
		]);
	});

	test("reads a long run of letters in linear time", () => {
		let started = performance.now();
		expect(parse(`${"A".repeat(50_000)}!`)).toEqual([]);
		expect(performance.now() - started).toBeLessThan(1_000);
	});

	test("keeps header order between ranges of equal quality", () => {
		let languages = parse("fr;q=0.5,de,es;q=0.5,it");
		expect(languages.map((language) => language.tag)).toEqual(["de", "it", "fr", "es"]);
	});

	test("reads a script without a region and a region after a variant-free tag", () => {
		expect(parse("sr-Latn")[0]).toMatchObject({ code: "sr", script: "Latn", region: undefined });
		expect(parse("es-419")[0]).toMatchObject({ code: "es", script: null, region: "419" });
	});

	test("keeps every subtag of a long tag, including extensions and private use", () => {
		expect(parse("zh-Hant-CN-x-private1-private2")[0]).toMatchObject({
			tag: "zh-Hant-CN-x-private1-private2",
			code: "zh",
			script: "Hant",
			region: "CN",
		});
		expect(parse("x-klingon")[0]?.tag).toBe("x-klingon");
	});

	test("accepts whitespace around the semicolon and an uppercase Q", () => {
		let languages = parse("en ;q=0.5,es\t; Q=0.7");
		expect(languages.map((language) => [language.tag, language.quality])).toEqual([
			["es", 0.7],
			["en", 0.5],
		]);
	});

	test("accepts every qvalue form RFC 9110 allows", () => {
		let languages = parse("a;q=1.000,b;q=1.,c;q=0.999,d;q=0.,e;q=0");
		expect(languages.map((language) => [language.tag, language.quality])).toEqual([
			["a", 1],
			["b", 1],
			["c", 0.999],
			["d", 0],
			["e", 0],
		]);
	});

	test("skips a range whose qvalue is out of range or too precise", () => {
		let header = "a;q=1.5,b;q=1.001,c;q=0.0001,d;q=2,e;q=-1,f;q=.5,g;q=,h;q=0.5";
		expect(parse(header).map((language) => language.tag)).toEqual(["h"]);
	});

	test("skips a range with a subtag longer than eight characters", () => {
		expect(parse("abcdefghi,en-abcdefghi,en")).toEqual([
			{ tag: "en", code: "en", script: null, region: undefined, quality: 1 },
		]);
	});
});

describe(lookupFallbacks, () => {
	test("truncates from the end, removing a dangling singleton with its subtag", () => {
		expect(lookupFallbacks("zh-Hant-CN-x-private1-private2")).toEqual([
			"zh-Hant-CN-x-private1-private2",
			"zh-Hant-CN-x-private1",
			"zh-Hant-CN",
			"zh-Hant",
			"zh",
		]);
	});

	test("removes an extension singleton the same way", () => {
		expect(lookupFallbacks("de-CH-u-co-phonebk")).toEqual([
			"de-CH-u-co-phonebk",
			"de-CH-u-co",
			"de-CH",
			"de",
		]);
	});

	test("leaves a private-use tag with no fallback", () => {
		expect(lookupFallbacks("x-klingon")).toEqual(["x-klingon"]);
	});
});

describe(pick, () => {
	test("picks an exact match", () => {
		expect(pick(["en-US", "es"], "en-US")).toBe("en-US");
	});

	test("honors quality ordering across ranges", () => {
		expect(pick(["en", "es"], "fr;q=1,es;q=0.8,en;q=0.9")).toBe("en");
	});

	test("skips unsupported higher-quality ranges", () => {
		expect(pick(["es"], "fr;q=1,es;q=0.5")).toBe("es");
	});

	test("strict mode does not match a different region", () => {
		expect(pick(["en-GB"], "en-US")).toBeNull();
	});

	test("strict mode does not widen a range to a more specific tag", () => {
		expect(pick(["en-GB"], "en")).toBeNull();
		expect(pick(["de-CH-1996"], "de-CH")).toBeNull();
	});

	test("Lookup truncates a range to a supported language", () => {
		expect(pick(["en", "es"], "es-UY")).toBe("es");
		expect(pick(["zh-Hant", "zh"], "zh-Hant-TW")).toBe("zh-Hant");
		expect(pick(["zh"], "zh-Hant-CN-x-private1-private2")).toBe("zh");
	});

	test("Lookup tries every truncation of a range before the next range", () => {
		expect(pick(["en", "es"], "es-UY,en;q=0.9")).toBe("es");
		expect(pick(["en", "es"], "es-UY,en")).toBe("es");
	});

	test("Lookup prefers the most specific supported truncation", () => {
		expect(pick(["zh", "zh-Hant", "zh-Hant-TW"], "zh-Hant-TW")).toBe("zh-Hant-TW");
		expect(pick(["zh", "zh-Hant"], "zh-Hant-TW")).toBe("zh-Hant");
	});

	test("compares case-insensitively and returns the configured casing", () => {
		expect(pick(["pt-BR", "zh-Hant"], "PT-br")).toBe("pt-BR");
		expect(pick(["zh-Hant"], "ZH-HANT-TW")).toBe("zh-Hant");
	});

	test("the wildcard matches nothing in either mode", () => {
		expect(pick(["en"], "*")).toBeNull();
		expect(pick(["en"], "*", { loose: true })).toBeNull();
		expect(pick(["en", "es"], "*,es;q=0.5")).toBe("es");
	});

	test("a private-use range matches only an identical supported tag", () => {
		expect(pick(["en", "x-klingon"], "x-klingon")).toBe("x-klingon");
		expect(pick(["en"], "x-klingon")).toBeNull();
	});

	test("a q=0 range is never picked", () => {
		expect(pick(["en", "es"], "es;q=0")).toBeNull();
		expect(pick(["en", "es"], "es;q=0", { loose: true })).toBeNull();
	});

	test("a q=0 range excludes the language it names from other ranges' matches", () => {
		expect(pick(["en", "es"], "es-UY,es;q=0,en;q=0.5")).toBe("en");
		expect(pick(["es-ES", "en"], "es-ES;q=0,es-MX,en;q=0.1", { loose: true })).toBe("en");
	});

	test("a malformed range is skipped", () => {
		expect(pick(["en", "es"], "es;q=1.5,en;q=0.9")).toBe("en");
		expect(pick(["en", "es"], "es;q=0.0001,en;q=0.9")).toBe("en");
	});

	test("loose mode matches on the primary code alone", () => {
		expect(pick(["en-GB"], "en-US", { loose: true })).toBe("en-GB");
	});

	test("returns null when nothing is supported", () => {
		expect(pick(["es"], "fr")).toBeNull();
		expect(pick([], "fr")).toBeNull();
	});
});

describe(formatLanguageString, () => {
	test("joins code, script, and region with dashes", () => {
		expect(formatLanguageString({ code: "zh", script: "Hant", region: "TW" })).toBe("zh-Hant-TW");
		expect(formatLanguageString({ code: "en", script: null, region: "US" })).toBe("en-US");
		expect(formatLanguageString({ code: "en", script: null, region: undefined })).toBe("en");
	});
});
