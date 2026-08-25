/**
 * Unit tests for the cron-job time-zone list: the `"UTC"` exception the IANA
 * enumeration doesn't carry, the absence of a second spelling for it, and the
 * region grouping the pickers render.
 *
 * Assertions name only zones every runtime this app runs on enumerates. The list
 * follows the host's ICU build — the Workers runtime returns fewer zones than the
 * test runtime, and only the test runtime enumerates `Etc/GMT±N` — so asserting on
 * a zone one of them lacks would pass here and fail in production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	DEFAULT_TIMEZONE,
	groupedTimezones,
	isSupportedTimezone,
	supportedTimezones,
} from "~/app/lib/timezones";

describe("supportedTimezones", () => {
	/**
	 * The Workers runtime enumerates no `"UTC"` zone, while this test's runtime does,
	 * which is why the prepended default also has to de-duplicate.
	 */
	test("leads with the default, so a picker can offer it above the regional groups", () => {
		expect(supportedTimezones()[0]).toBe(DEFAULT_TIMEZONE);
	});

	test("lists every zone once, so a picker never renders a duplicate option", () => {
		let zones = supportedTimezones();
		expect(new Set(zones).size).toBe(zones.length);
	});

	test("carries the real zones alongside the default", () => {
		expect(supportedTimezones()).toContain("America/New_York");
		expect(supportedTimezones()).toContain("Europe/Madrid");
	});
});

describe("isSupportedTimezone", () => {
	test("accepts the default, the value every stored cron job holds", () => {
		expect(isSupportedTimezone(DEFAULT_TIMEZONE)).toBe(true);
	});

	test("accepts an ordinary IANA zone", () => {
		expect(isSupportedTimezone("Asia/Tokyo")).toBe(true);
	});

	test("rejects a zone no database knows", () => {
		expect(isSupportedTimezone("Mars/Olympus_Mons")).toBe(false);
	});

	test("rejects the UTC alias, so one zone keeps one stored spelling", () => {
		expect(isSupportedTimezone("Etc/UTC")).toBe(false);
	});
});

describe("groupedTimezones", () => {
	test("groups zones under their area prefix", () => {
		let europe = groupedTimezones().find((group) => group.region === "Europe");
		expect(europe).toBeDefined();
		expect(europe?.zones).toContain("Europe/Madrid");
		expect(europe?.zones.every((zone) => zone.startsWith("Europe/"))).toBe(true);
	});

	test("leaves the default out, since it has no area to sit under", () => {
		let members = groupedTimezones().flatMap((group) => group.zones);
		expect(members).not.toContain(DEFAULT_TIMEZONE);
		expect(members.length).toBe(supportedTimezones().length - 1);
	});
});
