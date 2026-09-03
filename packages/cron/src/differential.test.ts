/**
 * A seeded differential run against `cron-parser` in UTC, where the two libraries are
 * meant to agree exactly. The corpus combines lists, ranges, steps and names across all
 * five fields, which is the region an enumeration cannot reach, and every comparison
 * calls the other library rather than a transcript of what it once said.
 *
 * UTC only on purpose: away from a transition the two agree, and the daylight saving
 * cases where they deliberately differ are pinned by name in `parity.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { CronExpressionParser } from "cron-parser";
import { describe, expect, test } from "vitest";

import { Schedule } from "./schedule";
import {
	ANCHORS,
	CORPUS_SEED,
	CORPUS_SIZE,
	randomExpressions,
	randomInvalidExpressions,
} from "./test/corpus";

/** How many occurrences each comparison walks in each direction. */
const DEPTH = 6;

/** The generated corpus, drawn once so every block compares the same expressions. */
const CORPUS = randomExpressions({ seed: CORPUS_SEED, count: CORPUS_SIZE });

/**
 * The occurrences `cron-parser` computes, so a divergence names the other side rather
 * than a value somebody typed.
 *
 * @param expression - The expression to walk.
 * @param from - Where to start, as an ISO string.
 * @param direction - Which way to walk.
 * @returns The occurrences as ISO strings.
 */
function theirs(expression: string, from: string, direction: "next" | "prev"): string[] {
	let interval = CronExpressionParser.parse(expression, {
		currentDate: new Date(from),
		tz: "UTC",
	});
	let runs: string[] = [];
	for (let index = 0; index < DEPTH; index++) {
		runs.push(interval[direction]().toDate().toISOString());
	}
	return runs;
}

/**
 * The occurrences this package computes, in the same shape.
 *
 * @param expression - The expression to walk.
 * @param from - Where to start, as an ISO string.
 * @param direction - Which way to walk.
 * @returns The occurrences as ISO strings.
 */
function ours(expression: string, from: string, direction: "next" | "prev"): string[] {
	let schedule = unwrap(Schedule.parse(expression));
	let cursor = new Date(from);
	let runs: string[] = [];
	for (let index = 0; index < DEPTH; index++) {
		cursor =
			direction === "next"
				? schedule.next({ from: cursor, timeZone: "UTC" })
				: schedule.prev({ from: cursor, timeZone: "UTC" });
		if (Number.isNaN(cursor.getTime())) break;
		runs.push(cursor.toISOString());
	}
	return runs;
}

describe(`differential run of ${CORPUS.length} generated expressions`, () => {
	/**
	 * The generator draws each field's list items from disjoint slices, so no value is
	 * named twice — the one shape the other library refuses and this one allows — and
	 * excluding it from the corpus is what keeps this comparison total.
	 */
	test("both libraries accept every generated expression", () => {
		let rejected: string[] = [];
		for (let expression of CORPUS) {
			if (Schedule.parse(expression).status === "failure") rejected.push(`ours: ${expression}`);
			try {
				CronExpressionParser.parse(expression, { tz: "UTC" });
			} catch {
				rejected.push(`theirs: ${expression}`);
			}
		}
		expect(rejected).toEqual([]);
	});

	test("agrees with cron-parser on every forward walk", () => {
		for (let [index, expression] of CORPUS.entries()) {
			let from = ANCHORS[index % ANCHORS.length] ?? "";
			expect({ expression, from, runs: ours(expression, from, "next") }).toEqual({
				expression,
				from,
				runs: theirs(expression, from, "next"),
			});
		}
	});

	/**
	 * Anchored three past the forward walk's index, so a backward walk starts where a
	 * forward walk did not and the two directions do not share the same handful of
	 * instants.
	 */
	test("agrees with cron-parser on every backward walk", () => {
		for (let [index, expression] of CORPUS.entries()) {
			let from = ANCHORS[(index + 3) % ANCHORS.length] ?? "";
			expect({ expression, from, runs: ours(expression, from, "prev") }).toEqual({
				expression,
				from,
				runs: theirs(expression, from, "prev"),
			});
		}
	});

	/**
	 * The normalized text is what a consumer stores and what a schedule still read
	 * through the other library during a migration would see, so it has to name the
	 * same schedule read back through either one.
	 */
	test("agrees on the normalized form of every expression it accepts", () => {
		for (let [index, expression] of CORPUS.entries()) {
			let from = ANCHORS[index % ANCHORS.length] ?? "";
			let normalized = unwrap(Schedule.parse(expression)).toString();
			expect({ expression, normalized, runs: theirs(normalized, from, "next") }).toEqual({
				expression,
				normalized,
				runs: theirs(expression, from, "next"),
			});
		}
	});
});

/**
 * The generated corpus writes day of week as 0 to 6, since a step reaching its `7`
 * alias is the one shape the two libraries read differently; that case is enumerated
 * exhaustively in `field-forms.test.ts` and pinned here so the choice stays visible.
 */
describe("where the generated corpus stops short of what the grammar allows", () => {
	/**
	 * Vixie cron's bitmap folds the range's bit 7 onto bit 0, so `6-7/2` never sets
	 * Sunday; cron-parser added Sunday for any range ending in 7 until 5.10.0's fix.
	 * This pins that semantics directly, independent of whether the two agree.
	 */
	test("only reaches Sunday through a step that actually lands on seven", () => {
		let from = new Date("2026-02-28T12:00:00Z");
		let saturdays = ["2026-03-07T00:00:00.000Z", "2026-03-14T00:00:00.000Z"];

		expect(
			unwrap(Schedule.parse("0 0 * * 6-7/2"))
				.next({ from, timeZone: "UTC", count: 2 })
				.map((date) => date.toISOString()),
		).toEqual(saturdays);

		let interval = CronExpressionParser.parse("0 0 * * 6-7/2", { currentDate: from, tz: "UTC" });
		expect([
			interval.next().toDate().toISOString(),
			interval.next().toDate().toISOString(),
		]).toEqual(saturdays);
	});

	/**
	 * `3/3` reaches Wednesday and Saturday: 3, then 6, then 9 which is past the field.
	 * cron-parser used to add Sunday here too, until 5.10.0's fix.
	 */
	test("reads a step on a single day-of-week value the same way", () => {
		let from = new Date("2026-02-28T12:00:00Z");
		let wednesday = "2026-03-04T00:00:00.000Z";
		expect(unwrap(Schedule.parse("0 0 * * 3/3")).toString()).toBe("0 0 * * 3,6");
		expect(
			unwrap(Schedule.parse("0 0 * * 3/3")).next({ from, timeZone: "UTC" }).toISOString(),
		).toBe(wednesday);

		let interval = CronExpressionParser.parse("0 0 * * 3/3", { currentDate: from, tz: "UTC" });
		expect(interval.next().toDate().toISOString()).toBe(wednesday);
	});

	/**
	 * The two libraries only diverge when a stride steps over 7, so a step that lands
	 * on it exactly — every day, or every seventh — still matches.
	 */
	test("agrees on every day-of-week step whose stride does land on seven", () => {
		for (let form of ["*", "*/1", "0-7", "0-7/7", "1-7/2", "1-7/3", "5-7/1", "7", "6,7"]) {
			let expression = `0 0 * * ${form}`;
			expect({ form, runs: ours(expression, "2026-03-01T00:00:00Z", "next") }).toEqual({
				form,
				runs: theirs(expression, "2026-03-01T00:00:00Z", "next"),
			});
		}
	});
});

describe(`differential run of ${CORPUS.length} generated non-expressions`, () => {
	/**
	 * Each generated non-expression is a valid expression with one character dropped
	 * in that no cron grammar has a rule for, so the expected answer is known without
	 * a lookup table.
	 */
	test("both libraries reject every generated non-expression", () => {
		for (let expression of randomInvalidExpressions({ seed: CORPUS_SEED, count: CORPUS_SIZE })) {
			let theirVerdict = (() => {
				try {
					CronExpressionParser.parse(expression, { tz: "UTC" });
					return "accepted";
				} catch {
					return "rejected";
				}
			})();
			expect({ expression, ours: Schedule.parse(expression).status, theirs: theirVerdict }).toEqual(
				{
					expression,
					ours: "failure",
					theirs: "rejected",
				},
			);
		}
	});
});
