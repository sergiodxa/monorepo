/**
 * Checks the base64url key reading every subscription and VAPID key goes through: padding
 * is optional, and a hostile run of `=` costs linear time whether it pads or precedes data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { decodeBase64Url, sameKey, trimPadding } from "./keys.js";

describe("trimPadding", () => {
	test("drops only the trailing padding", () => {
		expect(trimPadding("AQID==")).toBe("AQID");
		expect(trimPadding("AQID")).toBe("AQID");
		expect(trimPadding("A=B=")).toBe("A=B");
		expect(trimPadding("===")).toBe("");
	});
});

describe("decodeBase64Url", () => {
	test("reads padded and unpadded text alike", () => {
		expect(decodeBase64Url("AQI=")).toEqual(new Uint8Array([1, 2]));
		expect(decodeBase64Url("AQI")).toEqual(new Uint8Array([1, 2]));
	});

	test("handles a run of 50,000 `=` in linear time", () => {
		let started = performance.now();
		expect(decodeBase64Url(`AQID${"=".repeat(50_000)}`)).toEqual(new Uint8Array([1, 2, 3]));
		expect(decodeBase64Url(`A${"=".repeat(50_000)}A`)).toBeNull();
		expect(performance.now() - started).toBeLessThan(500);
	});
});

describe("sameKey", () => {
	test("compares a padded key equal to its unpadded spelling", () => {
		expect(sameKey("AQI=", "AQI")).toBe(true);
		expect(sameKey("AQI=", "AQM")).toBe(false);
	});
});
