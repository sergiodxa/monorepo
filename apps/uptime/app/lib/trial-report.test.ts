/**
 * Unit tests for the free-watch bucketing: a period with several checks
 * reports the worst of them, an uncovered period reports as empty, and
 * checks outside the range are excluded from every period.
 *
 * Plus the incident grouping a report names its outages from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Segmentable } from "~/app/lib/trial-report";

import { incidentsFrom, segmentsOver } from "~/app/lib/trial-report";

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

/**
 * Incidents are a derived figure: consecutive failing checks merge into
 * one run, and any check that comes back — even `degraded` — closes it.
 */
describe("incidentsFrom", () => {
	test("reports nothing for a target that never failed", () => {
		expect(incidentsFrom([at(0, "up"), at(HOUR, "up")])).toHaveLength(0);
	});

	test("reports nothing for a target that was only ever slow", () => {
		expect(incidentsFrom([at(0, "up"), at(HOUR, "degraded")])).toHaveLength(0);
	});

	test("groups consecutive failures into one incident, counting its checks", () => {
		let incidents = incidentsFrom([
			at(0, "up"),
			at(HOUR, "down"),
			at(2 * HOUR, "down"),
			at(3 * HOUR, "up"),
		]);

		expect(incidents).toEqual([{ startedAt: HOUR, lastFailureAt: 2 * HOUR, checks: 2 }]);
	});

	test("separates two outages that recovered in between", () => {
		let incidents = incidentsFrom([
			at(0, "down"),
			at(HOUR, "up"),
			at(2 * HOUR, "down"),
			at(3 * HOUR, "down"),
		]);

		expect(incidents).toHaveLength(2);
		expect(incidents[0]).toEqual({ startedAt: 0, lastFailureAt: 0, checks: 1 });
		expect(incidents[1]).toEqual({ startedAt: 2 * HOUR, lastFailureAt: 3 * HOUR, checks: 2 });
	});

	test("closes a run on a degraded check, which is a check that answered", () => {
		let incidents = incidentsFrom([at(0, "down"), at(HOUR, "degraded"), at(2 * HOUR, "down")]);

		expect(incidents).toHaveLength(2);
	});

	test("reads the timeline in time order whatever order it was handed", () => {
		let incidents = incidentsFrom([at(2 * HOUR, "down"), at(0, "down"), at(HOUR, "down")]);

		expect(incidents).toEqual([{ startedAt: 0, lastFailureAt: 2 * HOUR, checks: 3 }]);
	});

	test("reports nothing for a target with no checks at all", () => {
		expect(incidentsFrom([])).toHaveLength(0);
	});
});
