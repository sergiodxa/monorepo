/**
 * Tests for browser reading: that each browser is claimed by its own rule
 * rather than by the tokens it inherits from Chromium or WebKit, and that a
 * string naming no known browser comes back empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { BrowserName } from "./types.js";

import { detectBrowser } from "./browser.js";

describe("detectBrowser", () => {
	test.each<[string, BrowserName, string]>([
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			"Chrome",
			"122.0.0.0",
		],
		[
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
			"Safari",
			"17.4",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
			"Firefox",
			"124.0",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.52",
			"Edge",
			"122.0.2365.52",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 OPR/108.0.5067.24",
			"Opera",
			"108.0.5067.24",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Vivaldi/6.6.3271.53",
			"Vivaldi",
			"6.6.3271.53",
		],
		[
			"Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
			"Samsung Internet",
			"23.0",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 YaBrowser/24.1.0.0 Safari/537.36",
			"Yandex Browser",
			"24.1.0.0",
		],
		[
			"Mozilla/5.0 (Linux; Android 9; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/113.3.3 like Chrome/113.0.5672.162 Safari/537.36",
			"Silk",
			"113.3.3",
		],
		[
			"Mozilla/5.0 (Linux; U; Android 13; en-US; SM-S918B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 UCBrowser/15.5.0.1204 Mobile Safari/537.36",
			"UC Browser",
			"15.5.0.1204",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
			"Internet Explorer",
			"11.0",
		],
		["Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)", "Internet Explorer", "8.0"],
	])("reads %j as its own browser", (userAgent, name, version) => {
		expect(detectBrowser(userAgent)).toEqual({ name, version });
	});

	test.each<[string, BrowserName, string]>([
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",
			"Chrome",
			"122.0.6261.89",
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15",
			"Firefox",
			"124.0",
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/122.0.2365.86 Version/17.0 Mobile/15E148 Safari/604.1",
			"Edge",
			"122.0.2365.86",
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1 Ddg/17.3",
			"DuckDuckGo",
			"17.3",
		],
	])("reads the iOS spelling of %j as the browser it is", (userAgent, name, version) => {
		expect(detectBrowser(userAgent)).toEqual({ name, version });
	});

	test("reads the Presto-era Opera version from its Version token", () => {
		let userAgent = "Opera/9.80 (Windows NT 6.0) Presto/2.12.388 Version/12.14";

		expect(detectBrowser(userAgent)).toEqual({ name: "Opera", version: "12.14" });
	});

	test("tells Chromium apart from the Chrome token it also carries", () => {
		let userAgent =
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/122.0.6261.94 Chrome/122.0.6261.94 Safari/537.36";

		expect(detectBrowser(userAgent)).toEqual({ name: "Chromium", version: "122.0.6261.94" });
	});

	test.each(["", "curl/8.4.0", "Googlebot/2.1 (+http://www.google.com/bot.html)"])(
		"answers empty for %j, which names no known browser",
		(userAgent) => {
			expect(detectBrowser(userAgent)).toEqual({ name: null, version: null });
		},
	);
});
