/**
 * Tests for device reading: the form factor each platform gives away, the model
 * Android discloses once the segments standing in for one are skipped, and the
 * vendor a model prefix names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Device } from "./types.js";

import { detectDevice } from "./device.js";

describe("detectDevice", () => {
	test.each<[string, Device]>([
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
			{ type: "mobile", vendor: "Apple", model: "iPhone" },
		],
		[
			"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
			{ type: "tablet", vendor: "Apple", model: "iPad" },
		],
		[
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
			{ type: "desktop", vendor: "Apple", model: "Mac" },
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			{ type: "desktop", vendor: null, model: null },
		],
	])("reads the form factor %j names", (userAgent, expected) => {
		expect(detectDevice(userAgent)).toEqual(expected);
	});

	test("separates an Android phone from a tablet by the Mobile token", () => {
		let phone =
			"Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
		let tablet =
			"Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

		expect(detectDevice(phone)).toEqual({
			type: "mobile",
			vendor: "Samsung",
			model: "SM-S918B",
		});
		expect(detectDevice(tablet)).toEqual({ type: "tablet", vendor: "Samsung", model: "SM-X710" });
	});

	test("names the vendor a model prefix identifies", () => {
		let pixel =
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

		expect(detectDevice(pixel)).toEqual({ type: "mobile", vendor: "Google", model: "Pixel 8" });
	});

	test("reads past the locale an older Android build lists before the model", () => {
		let userAgent =
			"Mozilla/5.0 (Linux; U; Android 4.4.2; en-us; SM-T310 Build/KOT49H) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30";

		expect(detectDevice(userAgent)).toEqual({
			type: "tablet",
			vendor: "Samsung",
			model: "SM-T310",
		});
	});

	test.each([
		"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
		"Mozilla/5.0 (Android 13; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0",
	])("reports no model where %j discloses none", (userAgent) => {
		expect(detectDevice(userAgent)).toEqual({ type: "mobile", vendor: null, model: null });
	});

	test.each<[string, Device]>([
		[
			"Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15",
			{ type: "console", vendor: "Sony", model: "PlayStation 5" },
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363",
			{ type: "console", vendor: "Microsoft", model: "Xbox One" },
		],
		[
			"Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/601.6 (KHTML, like Gecko) NF/4.0.0.5.9 NintendoBrowser/5.1.0.13343",
			{ type: "console", vendor: "Nintendo", model: "Nintendo Switch" },
		],
	])("reads %j as the console it is", (userAgent, expected) => {
		expect(detectDevice(userAgent)).toEqual(expected);
	});

	test("claims a television before the system it shares with phones", () => {
		let tizen =
			"Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36";
		let fireTV =
			"Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7233.3079N) AppleWebKit/537.36 (KHTML, like Gecko) Silk/113.3.3 like Chrome/113.0.5672.162 Safari/537.36";

		expect(detectDevice(tizen)).toEqual({ type: "tv", vendor: null, model: null });
		expect(detectDevice(fireTV)).toEqual({ type: "tv", vendor: "Amazon", model: null });
	});

	test("reads a Windows phone as a phone rather than as the desktop system", () => {
		let userAgent =
			"Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15254";

		expect(detectDevice(userAgent).type).toBe("mobile");
	});

	test("answers empty for a string that names no platform", () => {
		expect(detectDevice("curl/8.4.0")).toEqual({ type: null, vendor: null, model: null });
	});
});
