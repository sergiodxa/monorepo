/**
 * Parity against `cron-parser`, executed live so a change on either side
 * is caught immediately. Expressions the product stores are checked in
 * `UTC` first, since agreement there decides which monitor alerts the day
 * the library is swapped. Delete this file once nothing depends on
 * `cron-parser`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@pkg/result";
import { CronExpressionParser } from "cron-parser";
import { describe, expect, test } from "vitest";

import { Schedule } from "./schedule";

/**
 * Every distinct cron expression stored by the product, read from the production
 * database. All of them are stored against `UTC`.
 */
const STORED_IN_PRODUCTION = [
	"0 0 * * *",
	"* * * * *",
	"*/10 * * * *",
	"*/5 * * * *",
	"0 * * * *",
	"0 1 * * *",
	"0 6 * * *",
] as const;

/**
 * Expressions the product's own tests, docs, and locale files use today,
 * ahead of being stored: they are the shapes a user is shown and told to
 * type, making them the next candidates to land in production.
 */
const EXERCISED_BY_THE_APP = [
	"0 9 * * *",
	"0 2 * * *",
	"0 3 * * *",
	"@daily",
	"@hourly",
	"@weekly",
	"*/15 * * * *",
	"5 * * * *",
	"30 9 * * *",
	"0 0 * * 1",
	"0 9 * * 1",
	"0 0 15 * *",
	"0 0 1 * *",
	"0 0 1 1 *",
	"0 0 1 1 1",
	"0 2 * * 0",
] as const;

/** Instants chosen to land on month ends, a leap day, and a year boundary. */
const ANCHORS = [
	"2026-01-01T00:00:00Z",
	"2026-02-28T23:59:00Z",
	"2026-06-15T12:00:00Z",
	"2026-12-31T23:30:00Z",
	"2028-02-29T12:00:00Z",
] as const;

/** How many occurrences each comparison walks. */
const DEPTH = 25;

/** The occurrences `cron-parser` computes, so a divergence names the other side. */
function theirOccurrences(
	expression: string,
	timeZone: string,
	from: string,
	count: number,
): string[] {
	let interval = CronExpressionParser.parse(expression, {
		currentDate: new Date(from),
		tz: timeZone,
	});
	let runs: string[] = [];
	for (let index = 0; index < count; index++) runs.push(interval.next().toDate().toISOString());
	return runs;
}

function ourOccurrences(
	expression: string,
	timeZone: string,
	from: string,
	count: number,
): string[] {
	return unwrap(Schedule.parse(expression))
		.next({ from: new Date(from), timeZone, count })
		.map((date) => date.toISOString());
}

describe("parity for what the product has stored", () => {
	test("agrees exactly with cron-parser on every stored expression, in UTC", () => {
		for (let expression of STORED_IN_PRODUCTION) {
			for (let from of ANCHORS) {
				expect({ expression, from, runs: ourOccurrences(expression, "UTC", from, DEPTH) }).toEqual({
					expression,
					from,
					runs: theirOccurrences(expression, "UTC", from, DEPTH),
				});
			}
		}
	});

	test("agrees exactly on every expression the app's tests and docs use, in UTC", () => {
		for (let expression of EXERCISED_BY_THE_APP) {
			for (let from of ANCHORS) {
				expect({ expression, from, runs: ourOccurrences(expression, "UTC", from, DEPTH) }).toEqual({
					expression,
					from,
					runs: theirOccurrences(expression, "UTC", from, DEPTH),
				});
			}
		}
	});

	test("agrees in America/New_York away from a transition", () => {
		/**
		 * The other zone the product names; June and December sit far enough from
		 * a transition that 25 occurrences of a daily schedule stay inside one
		 * offset.
		 */
		for (let expression of [...STORED_IN_PRODUCTION, ...EXERCISED_BY_THE_APP]) {
			for (let from of ["2026-06-15T12:00:00Z", "2026-12-01T12:00:00Z"]) {
				let ours = ourOccurrences(expression, "America/New_York", from, 10);
				expect({ expression, from, runs: ours }).toEqual({
					expression,
					from,
					runs: theirOccurrences(expression, "America/New_York", from, 10),
				});
			}
		}
	});

	/**
	 * Four expressions × 9,000 occurrences each, cross-checked one by one, needs
	 * more than the 5s default.
	 */
	test("computes a whole month of occurrences the same way, which is what billing counts", () => {
		/**
		 * The product estimates consumed pings by walking a month of occurrences,
		 * so the count and not only the instants has to match.
		 */
		let start = "2026-06-01T00:00:00Z";
		let end = new Date("2026-07-01T00:00:00Z");

		for (let expression of ["*/5 * * * *", "*/10 * * * *", "0 * * * *", "0 0 * * *"]) {
			let ours = ourOccurrences(expression, "UTC", start, 9_000).filter(
				(run) => new Date(run) < end,
			);
			let theirs = theirOccurrences(expression, "UTC", start, 9_000).filter(
				(run) => new Date(run) < end,
			);
			expect({ expression, count: ours.length, runs: ours }).toEqual({
				expression,
				count: theirs.length,
				runs: theirs,
			});
		}
	}, 30_000);
});

describe("parity through a daylight saving transition", () => {
	/** Anchored two hours before each transition so the first occurrences straddle it. */
	const SPRING_FORWARD = [
		{ timeZone: "America/New_York", from: "2026-03-08T05:00:00Z" },
		{ timeZone: "Europe/Madrid", from: "2026-03-29T00:00:00Z" },
		{ timeZone: "Europe/London", from: "2026-03-29T00:00:00Z" },
		{ timeZone: "Australia/Sydney", from: "2026-10-03T14:00:00Z" },
		{ timeZone: "Pacific/Auckland", from: "2026-09-26T12:00:00Z" },
	] as const;

	const FALL_BACK = [
		{ timeZone: "America/New_York", from: "2026-11-01T04:00:00Z" },
		{ timeZone: "Europe/Madrid", from: "2026-10-25T00:00:00Z" },
		{ timeZone: "Europe/London", from: "2026-10-25T00:00:00Z" },
		{ timeZone: "Australia/Sydney", from: "2026-04-04T14:00:00Z" },
		{ timeZone: "Pacific/Auckland", from: "2026-04-04T12:00:00Z" },
	] as const;

	test("agrees on every stored expression across a spring-forward transition", () => {
		for (let { timeZone, from } of SPRING_FORWARD) {
			for (let expression of STORED_IN_PRODUCTION) {
				expect({
					expression,
					timeZone,
					runs: ourOccurrences(expression, timeZone, from, 10),
				}).toEqual({
					expression,
					timeZone,
					runs: theirOccurrences(expression, timeZone, from, 10),
				});
			}
		}
	});

	test("agrees on every stored expression across a fall-back transition", () => {
		for (let { timeZone, from } of FALL_BACK) {
			for (let expression of STORED_IN_PRODUCTION) {
				expect({
					expression,
					timeZone,
					runs: ourOccurrences(expression, timeZone, from, 10),
				}).toEqual({
					expression,
					timeZone,
					runs: theirOccurrences(expression, timeZone, from, 10),
				});
			}
		}
	});

	test("agrees on the app's other expressions across both transitions", () => {
		/**
		 * Every expression the app uses, including `0 2 * * *` and `0 2 * * 0`
		 * whose wall time is the hour New York skips. Both libraries carry the
		 * run past the jump looking forward; only looking back do they disagree.
		 */
		for (let { timeZone, from } of [...SPRING_FORWARD, ...FALL_BACK]) {
			for (let expression of EXERCISED_BY_THE_APP) {
				expect({
					expression,
					timeZone,
					runs: ourOccurrences(expression, timeZone, from, 10),
				}).toEqual({
					expression,
					timeZone,
					runs: theirOccurrences(expression, timeZone, from, 10),
				});
			}
		}
	});
});

describe("deliberate differences from cron-parser", () => {
	/**
	 * Each of these is a case where the two libraries disagree and this package
	 * keeps its own answer. Every case names the other library's answer too, so
	 * the choice stays visible and documented.
	 */

	test("looks back and still finds the run carried out of a skipped hour", () => {
		/**
		 * 02:00 does not exist in New York on 2026-03-08, so both libraries carry
		 * that run forward to 03:00 EDT. Walking back from a later instant, the
		 * other library returns a time a full day earlier than that carried run.
		 */
		let schedule = unwrap(Schedule.parse("0 2 * * *"));
		let timeZone = "America/New_York";
		let carried = "2026-03-08T07:00:00.000Z"; /** 03:00 EDT */

		expect(ourOccurrences("0 2 * * *", timeZone, "2026-03-07T12:00:00Z", 1)).toEqual([carried]);
		expect(theirOccurrences("0 2 * * *", timeZone, "2026-03-07T12:00:00Z", 1)).toEqual([carried]);

		expect(schedule.prev({ from: new Date("2026-03-08T09:00:00Z"), timeZone }).toISOString()).toBe(
			carried,
		);

		let interval = CronExpressionParser.parse("0 2 * * *", {
			currentDate: new Date("2026-03-08T09:00:00Z"),
			tz: timeZone,
		});
		expect(interval.prev().toDate().toISOString()).toBe("2026-03-07T07:00:00.000Z");
	});

	test("looks back to a weekly run in a skipped hour instead of the week before", () => {
		let schedule = unwrap(Schedule.parse("0 2 * * 0"));
		let timeZone = "America/New_York";

		expect(schedule.prev({ from: new Date("2026-03-08T09:00:00Z"), timeZone }).toISOString()).toBe(
			"2026-03-08T07:00:00.000Z",
		);

		let interval = CronExpressionParser.parse("0 2 * * 0", {
			currentDate: new Date("2026-03-08T09:00:00Z"),
			tz: timeZone,
		});
		expect(interval.prev().toDate().toISOString()).toBe("2026-03-01T07:00:00.000Z");
	});

	test("carries a midnight run out of a skipped midnight, where cron-parser loses a day", () => {
		/**
		 * Cairo starts daylight saving at 00:00, so `@daily` has no wall time to
		 * fire on 2026-04-24 — the same midnight-transition case as above, visible
		 * only in a zone whose transition lands exactly at midnight.
		 */
		let timeZone = "Africa/Cairo";
		let from = "2026-04-22T20:00:00Z";

		expect(ourOccurrences("@daily", timeZone, from, 3)).toEqual([
			"2026-04-22T22:00:00.000Z" /** 00:00 on the 23rd */,
			"2026-04-23T22:00:00.000Z" /** 01:00 on the 24th, carried out of the gap */,
			"2026-04-24T21:00:00.000Z" /** 00:00 on the 25th */,
		]);
		expect(theirOccurrences("@daily", timeZone, from, 3)).toEqual([
			"2026-04-22T22:00:00.000Z",
			"2026-04-24T21:00:00.000Z" /** the 24th is missing */,
			"2026-04-25T21:00:00.000Z",
		]);
	});

	test("looks back to the same pass of a repeated hour that it looks forward to", () => {
		/**
		 * 01:00 happens twice in New York on 2026-11-01. An appointment is kept
		 * once, so the first pass is the occurrence in both directions —
		 * cron-parser reports the first pass forward but the second pass back.
		 */
		let schedule = unwrap(Schedule.parse("0 1 * * *"));
		let timeZone = "America/New_York";

		let ours = schedule.prev({ from: new Date("2026-11-01T08:00:00Z"), timeZone });
		expect(ours.toISOString()).toBe("2026-11-01T05:00:00.000Z");

		let interval = CronExpressionParser.parse("0 1 * * *", {
			currentDate: new Date("2026-11-01T08:00:00Z"),
			tz: timeZone,
		});
		expect(interval.prev().toDate().toISOString()).toBe("2026-11-01T06:00:00.000Z");

		/** Ours is the instant `next` also reports, which is the property that matters. */
		expect(schedule.next({ from: new Date("2026-11-01T04:00:00Z"), timeZone }).toISOString()).toBe(
			"2026-11-01T05:00:00.000Z",
		);
	});

	test("keeps advancing where cron-parser gives up", () => {
		/**
		 * Lord Howe shifts by 30 minutes; cron-parser cannot walk across it.
		 * Before 5.10.0 it silently repeated the same instant from every
		 * further next(); now it throws once its step limit runs out.
		 */
		let timeZone = "Australia/Lord_Howe";
		let interval = CronExpressionParser.parse("0 * * * *", {
			currentDate: new Date("2026-04-04T13:00:00Z"),
			tz: timeZone,
		});
		expect(interval.next().toDate().toISOString()).toBe("2026-04-04T14:00:00.000Z");
		expect(() => interval.next()).toThrow("loop limit exceeded");

		/**
		 * Ours advances, and every instant it reports reads as minute zero on the
		 * zone's wall clock: 01:00 at +11, then 02:00 and 03:00 at +10:30.
		 */
		let schedule = unwrap(Schedule.parse("0 * * * *"));
		let ours = schedule.next({ from: new Date("2026-04-04T13:00:00Z"), timeZone, count: 3 });
		expect(ours.map((date) => date.toISOString())).toEqual([
			"2026-04-04T14:00:00.000Z",
			"2026-04-04T15:30:00.000Z",
			"2026-04-04T16:30:00.000Z",
		]);
		for (let occurrence of ours) expect(schedule.matches(occurrence, { timeZone })).toBe(true);
	});

	test("keeps walking back where cron-parser gives up", () => {
		/**
		 * Chatham's offset is 45 minutes off the hour. The other library used to
		 * return a :59-second instant walking back, then repeat an earlier one;
		 * since 5.10.0 it throws once its step limit runs out.
		 */
		let timeZone = "Pacific/Chatham";
		let interval = CronExpressionParser.parse("0 * * * *", {
			currentDate: new Date("2026-09-26T16:00:00Z"),
			tz: timeZone,
		});
		expect([
			interval.prev().toDate().toISOString(),
			interval.prev().toDate().toISOString(),
		]).toEqual(["2026-09-26T15:15:00.000Z", "2026-09-26T14:15:00.000Z"]);
		expect(() => interval.prev()).toThrow("loop limit exceeded");

		/**
		 * Ours walks back a minute-aligned hour at a time, landing on a distinct
		 * instant every step.
		 */
		let schedule = unwrap(Schedule.parse("0 * * * *"));
		let ours: Date[] = [];
		let cursor = new Date("2026-09-26T16:00:00Z");
		for (let index = 0; index < 4; index++) {
			cursor = schedule.prev({ from: cursor, timeZone });
			ours.push(cursor);
		}
		expect(ours.map((date) => date.toISOString())).toEqual([
			"2026-09-26T15:15:00.000Z",
			"2026-09-26T14:15:00.000Z",
			"2026-09-26T13:15:00.000Z",
			"2026-09-26T12:15:00.000Z",
		]);
		for (let occurrence of ours) expect(occurrence.getUTCSeconds()).toBe(0);
	});
});

describe("differences in what is accepted rather than computed", () => {
	test("rejects the syntax outside the standard five fields that cron-parser accepts", () => {
		/**
		 * Accepting the syntax without honoring the semantics is the failure mode
		 * worth avoiding, so these stay rejected on purpose. `W` is left out here
		 * since the other library rejects it too.
		 */
		for (let expression of [
			"* * * * * *",
			"*/5 * * * * *",
			"? ? * * *",
			"0 0 L * *",
			"0 0 * * 1#2",
			"0 0 * * 1L",
		]) {
			expect(Schedule.parse(expression).status).toBe("failure");
			expect(() => CronExpressionParser.parse(expression, { tz: "UTC" })).not.toThrow();
		}
	});

	test("rejects the day-of-month W extension, which cron-parser also rejects", () => {
		expect(Schedule.parse("0 0 1W * *").status).toBe("failure");
		expect(() => CronExpressionParser.parse("0 0 1W * *", { tz: "UTC" })).toThrow();
	});

	test("accepts a repeated list value that cron-parser rejects", () => {
		expect(unwrap(Schedule.parse("0 12 * * 1,1,1")).toString()).toBe("0 12 * * 1");
		expect(() => CronExpressionParser.parse("0 12 * * 1,1,1", { tz: "UTC" })).toThrow();
	});

	test("accepts @midnight, which cron-parser rejects, as a spelling of @daily", () => {
		/**
		 * The crontab specification lists it, and the product's own schedule
		 * descriptions already name it. Accepting it only widens what parses, so
		 * anything already stored stays readable.
		 */
		expect(unwrap(Schedule.parse("@midnight")).toString()).toBe("0 0 * * *");
		expect(() => CronExpressionParser.parse("@midnight", { tz: "UTC" })).toThrow();
	});

	test("agrees with cron-parser on the occurrences of every macro both accept", () => {
		for (let macro of ["@hourly", "@daily", "@weekly", "@monthly", "@yearly", "@annually"]) {
			expect({ macro, runs: ourOccurrences(macro, "UTC", "2026-06-15T12:00:00Z", 8) }).toEqual({
				macro,
				runs: theirOccurrences(macro, "UTC", "2026-06-15T12:00:00Z", 8),
			});
		}
	});
});
