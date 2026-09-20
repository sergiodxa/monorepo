/**
 * Tests for operating system reading: the platform's own numbering on each
 * system, the NT versions Windows reports instead of its marketing name, and
 * the release where the tablet system split off from the phone's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { OperatingSystem } from "./types.js";

import { detectOperatingSystem } from "./os.js";

describe("detectOperatingSystem", () => {
	test.each<[string, OperatingSystem]>([
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			{ name: "Windows", version: "10" },
		],
		[
			"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:60.0) Gecko/20100101 Firefox/60.0",
			{ name: "Windows", version: "7" },
		],
		[
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
			{ name: "macOS", version: "10.15.7" },
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
			{ name: "iOS", version: "17.4" },
		],
		[
			"Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
			{ name: "Android", version: "13" },
		],
		[
			"Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			{ name: "Chrome OS", version: "14541.0.0" },
		],
		[
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			{ name: "Linux", version: null },
		],
	])("reads %j in the platform's own numbering", (userAgent, expected) => {
		expect(detectOperatingSystem(userAgent)).toEqual(expected);
	});

	test("names the tablet system iPadOS from the release it was split off at", () => {
		let ipadOS =
			"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
		let beforeTheSplit =
			"Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1";

		expect(detectOperatingSystem(ipadOS)).toEqual({ name: "iPadOS", version: "17.4" });
		expect(detectOperatingSystem(beforeTheSplit)).toEqual({ name: "iOS", version: "12.5.7" });
	});

	test("claims a Windows phone before the Android version it reports for compatibility", () => {
		let userAgent =
			"Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15254";

		expect(detectOperatingSystem(userAgent)).toEqual({ name: "Windows Phone", version: "10.0" });
	});

	test("names Windows without a version when the NT release is one it does not map", () => {
		let userAgent = "Mozilla/4.0 (compatible; MSIE 5.0; Windows NT 4.0)";

		expect(detectOperatingSystem(userAgent)).toEqual({ name: "Windows", version: null });
	});

	test("answers empty for a string that names no platform", () => {
		expect(detectOperatingSystem("curl/8.4.0")).toEqual({ name: null, version: null });
	});
});
