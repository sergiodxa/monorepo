/**
 * Tests for the whole read: that the four parts of a real user agent string
 * agree with each other, and that a string the rules do not recognize still
 * answers with every field present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { parse } from "./parse.js";

describe("parse", () => {
	test("reads a desktop browser into all four parts", () => {
		let userAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

		expect(parse(userAgent)).toEqual({
			browser: { name: "Chrome", version: "122.0.0.0" },
			engine: { name: "Blink", version: "537.36" },
			os: { name: "Windows", version: "10" },
			device: { type: "desktop", vendor: null, model: null },
		});
	});

	test("reads a phone into all four parts", () => {
		let userAgent =
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

		expect(parse(userAgent)).toEqual({
			browser: { name: "Safari", version: "17.4" },
			engine: { name: "WebKit", version: "605.1.15" },
			os: { name: "iOS", version: "17.4" },
			device: { type: "mobile", vendor: "Apple", model: "iPhone" },
		});
	});

	test("answers with every field present for a string it does not recognize", () => {
		expect(parse("")).toEqual({
			browser: { name: null, version: null },
			engine: { name: null, version: null },
			os: { name: null, version: null },
			device: { type: null, vendor: null, model: null },
		});
	});
});
