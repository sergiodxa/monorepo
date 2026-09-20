/**
 * Tests for engine reading: that the Chromium family reports Blink while the
 * browsers Apple requires to render through WebKit report WebKit whatever name
 * they carry, and that the pre-Chromium engines still read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { detectEngine } from "./engine.js";

describe("detectEngine", () => {
	test("reports Blink for a Chromium browser, versioned by its WebKit build", () => {
		let userAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

		expect(detectEngine(userAgent)).toEqual({ name: "Blink", version: "537.36" });
	});

	test("reports Blink for the Chromium browsers that rename the token", () => {
		let edge =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.52";
		let samsung =
			"Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";

		expect(detectEngine(edge).name).toBe("Blink");
		expect(detectEngine(samsung).name).toBe("Blink");
	});

	test("reports WebKit for Safari and for every browser renamed on iOS", () => {
		let safari =
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
		let chromeOnIOS =
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1";

		expect(detectEngine(safari)).toEqual({ name: "WebKit", version: "605.1.15" });
		expect(detectEngine(chromeOnIOS)).toEqual({ name: "WebKit", version: "605.1.15" });
	});

	test("reports Gecko with the revision Firefox renders at", () => {
		let userAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";

		expect(detectEngine(userAgent)).toEqual({ name: "Gecko", version: "124.0" });
	});

	test("reports EdgeHTML for the Edge that predates its Chromium rebuild", () => {
		let userAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763";

		expect(detectEngine(userAgent)).toEqual({ name: "EdgeHTML", version: "18.17763" });
	});

	test("reports Trident for Internet Explorer and Presto for Opera before it", () => {
		let ie = "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko";
		let opera = "Opera/9.80 (Windows NT 6.0) Presto/2.12.388 Version/12.14";

		expect(detectEngine(ie)).toEqual({ name: "Trident", version: "7.0" });
		expect(detectEngine(opera)).toEqual({ name: "Presto", version: "2.12.388" });
	});

	test("answers empty for a string that renders nothing", () => {
		expect(detectEngine("curl/8.4.0")).toEqual({ name: null, version: null });
	});
});
