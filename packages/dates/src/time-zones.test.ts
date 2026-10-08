/**
 * Tests for the zone list: `"UTC"` leading even where the runtime omits it, one spelling
 * per zone, and the area grouping a picker renders. Assertions name only zones every
 * runtime enumerates, since the list follows the host's ICU build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	isSupportedTimeZone,
	supportedTimeZones,
	systemTimeZone,
	timeZonesByRegion,
} from "./time-zones.js";
import { isValidTimeZone } from "./zone.js";

describe("supportedTimeZones", () => {
	test("leads with UTC, so a picker can offer it above the regional groups", () => {
		expect(supportedTimeZones()[0]).toBe("UTC");
	});

	test("lists every zone once", () => {
		let zones = supportedTimeZones();
		expect(new Set(zones).size).toBe(zones.length);
	});

	test("carries the IANA zones", () => {
		expect(supportedTimeZones()).toContain("America/New_York");
		expect(supportedTimeZones()).toContain("Europe/Madrid");
	});
});

describe("isSupportedTimeZone", () => {
	test("accepts UTC and an ordinary IANA zone", () => {
		expect(isSupportedTimeZone("UTC")).toBe(true);
		expect(isSupportedTimeZone("Asia/Tokyo")).toBe(true);
	});

	test("rejects a zone no database knows", () => {
		expect(isSupportedTimeZone("Mars/Olympus_Mons")).toBe(false);
	});

	test("rejects the UTC alias Intl accepts, so one zone keeps one spelling", () => {
		expect(isValidTimeZone("Etc/UTC")).toBe(true);
		expect(isSupportedTimeZone("Etc/UTC")).toBe(false);
	});
});

describe("timeZonesByRegion", () => {
	test("groups zones under their area prefix", () => {
		let europe = timeZonesByRegion().find((group) => group.region === "Europe");
		expect(europe?.zones).toContain("Europe/Madrid");
		expect(europe?.zones.every((zone) => zone.startsWith("Europe/"))).toBe(true);
	});

	test("leaves UTC out, since it has no area to sit under", () => {
		let members = timeZonesByRegion().flatMap((group) => group.zones);
		expect(members).not.toContain("UTC");
		expect(members.length).toBe(supportedTimeZones().length - 1);
	});
});

describe("systemTimeZone", () => {
	test("names a zone every function here accepts", () => {
		expect(isValidTimeZone(systemTimeZone())).toBe(true);
	});
});
