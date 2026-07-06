/**
 * Covers Accept-Language parsing (quality ordering, script/region subtags,
 * malformed input tolerance) and supported-language matching in strict and
 * loose modes, including quality-aware picks across multiple client ranges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { formatLanguageString, parse, pick } from "./parser";

describe(parse, () => {
	test("parses a single language", () => {
		expect(parse("en")).toEqual([{ code: "en", script: null, region: undefined, quality: 1 }]);
	});

	test("parses a language with a region", () => {
		expect(parse("en-US")).toEqual([{ code: "en", script: null, region: "US", quality: 1 }]);
	});

	test("parses a language with script and region", () => {
		expect(parse("zh-Hant-TW")).toEqual([{ code: "zh", script: "Hant", region: "TW", quality: 1 }]);
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
		expect(parse("*")).toEqual([{ code: "*", script: null, region: undefined, quality: 1 }]);
	});

	test("returns an empty list for empty or garbage input", () => {
		expect(parse()).toEqual([]);
		expect(parse("")).toEqual([]);
		expect(parse("!!!")).toEqual([]);
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

	test("strict mode matches when the client omits the region", () => {
		expect(pick(["en-GB"], "en")).toBe("en-GB");
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
