/**
 * Unit tests for the digest arithmetic: that a period with several checks reports the worst
 * of them, that a period with none reports nothing rather than the last known state, that
 * checks outside the range are dropped instead of clamped into the nearest period, and that
 * uptime is printed to one decimal without a sign.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Segmentable } from "~/app/lib/trial-report";

import { formatUptime, segmentsOver } from "~/app/lib/trial-report";

const HOUR = 60 * 60 * 1000;

/** A check `offsetMs` into the range, so a case reads as the timeline it describes. */
function at(offsetMs: number, status: Segmentable["status"]): Segmentable {
	return { status, checked_at: offsetMs };
}

describe("segmentsOver", () => {
	test("places one check per period, oldest first", () => {
		let results = [at(0, "up"), at(HOUR, "degraded"), at(2 * HOUR, "down")];

		expect(segmentsOver(results, 0, HOUR, 3)).toEqual(["up", "degraded", "down"]);
	});

	test("reports the worst status of a period that holds several checks", () => {
		let results = [at(0, "up"), at(10, "down"), at(20, "degraded")];

		expect(segmentsOver(results, 0, HOUR, 1)).toEqual(["down"]);
	});

	test("prefers degraded over up within a period", () => {
		expect(segmentsOver([at(0, "up"), at(10, "degraded")], 0, HOUR, 1)).toEqual(["degraded"]);
	});

	test("leaves a period no check covers empty rather than carrying the last one forward", () => {
		let results = [at(0, "up"), at(2 * HOUR, "up")];

		expect(segmentsOver(results, 0, HOUR, 3)).toEqual(["up", null, "up"]);
	});

	test("drops checks from before the range instead of folding them into the first period", () => {
		let results = [at(-HOUR, "down"), at(0, "up")];

		expect(segmentsOver(results, 0, HOUR, 2)).toEqual(["up", null]);
	});

	test("drops checks from past the range instead of folding them into the last period", () => {
		let results = [at(0, "up"), at(5 * HOUR, "down")];

		expect(segmentsOver(results, 0, HOUR, 2)).toEqual(["up", null]);
	});

	test("reports an all-empty bar for a target with no checks", () => {
		expect(segmentsOver([], 0, HOUR, 4)).toEqual([null, null, null, null]);
	});
});

describe("formatUptime", () => {
	test("prints one decimal and no sign", () => {
		expect(formatUptime(0.994)).toBe("99.4");
		expect(formatUptime(1)).toBe("100.0");
		expect(formatUptime(0)).toBe("0.0");
	});
});
