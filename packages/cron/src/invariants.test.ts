/**
 * The invariants an occurrence search owes its caller, asserted as properties over a
 * generated corpus rather than case by case, and repeated across a table of zones with
 * a positive, negative, half-hour, three-quarter-hour, fixed, midnight-transitioning,
 * thirty-minute and two-hour offset among them.
 *
 * Nothing here names an expected instant. Every assertion compares two answers the
 * package gives by different routes, which is what lets it fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import { Schedule } from "./schedule";
import {
	ANCHORS,
	CORPUS_SEED,
	CORPUS_SIZE,
	randomExpressions,
	UNKNOWN_ZONES,
	ZONE_CASES,
	ZONE_SWEEP_EXPRESSIONS,
} from "./test/corpus";
import {
	expectDescriptorShape,
	expectOccurrenceInvariants,
	expectStableNormalization,
	expectWalksAgree,
} from "./test/properties";
import { offsetAt } from "./time-zone";

/** The generated corpus, drawn once so every block holds the same expressions. */
const CORPUS = randomExpressions({ seed: CORPUS_SEED, count: CORPUS_SIZE });

/**
 * How many of the corpus the full occurrence bundle runs over. The bundle asks a
 * schedule roughly a hundred questions, so it takes a fifth of the corpus while the
 * cheaper properties take all of it, keeping the package's suite a few seconds. Raising
 * `CRON_FUZZ_ITERATIONS` grows both.
 */
const OCCURRENCE_SAMPLE = Math.max(400, Math.floor(CORPUS.length / 5));

/** A day in milliseconds, for sizing the windows the zone sweep walks. */
const DAY_MS = 86_400_000;

describe(`properties over ${CORPUS.length} generated expressions`, () => {
	test("every one normalizes back to itself and to the same fields", () => {
		for (let expression of CORPUS) expectStableNormalization(expression);
	});

	test("every one reports the descriptor its fields call for", () => {
		for (let expression of CORPUS) expectDescriptorShape(expression);
	});

	test(`the first ${OCCURRENCE_SAMPLE} hold every occurrence invariant, in UTC`, () => {
		for (let [index, expression] of CORPUS.slice(0, OCCURRENCE_SAMPLE).entries()) {
			expectOccurrenceInvariants(expression, {
				from: ANCHORS[index % ANCHORS.length] ?? "",
				timeZone: "UTC",
			});
		}
	});

	test("every one finds something to fire on inside the search horizon", () => {
		// A parsed schedule that can never occur would be a validation failure that got
		// through, and it would read as a monitor that is never late rather than as a bug.
		for (let [index, expression] of CORPUS.entries()) {
			let from = new Date(ANCHORS[index % ANCHORS.length] ?? "");
			let next = unwrap(Schedule.parse(expression)).next({ from, timeZone: "UTC" });
			expect({ expression, found: !Number.isNaN(next.getTime()) }).toEqual({
				expression,
				found: true,
			});
		}
	});
});

describe.each(ZONE_CASES.map((zone) => [zone.timeZone, zone] as const))(
	"occurrences in %s",
	(_name, zone) => {
		test(`holds every invariant there (${zone.note})`, () => {
			for (let expression of ZONE_SWEEP_EXPRESSIONS) {
				expectOccurrenceInvariants(expression, {
					from: zone.anchor,
					timeZone: zone.timeZone,
					count: 8,
				});
			}
		});

		test("finds the same occurrences walking a window backward as forward", () => {
			// The window straddles whatever the zone does at its anchor, which for the zones
			// that transition is a jump forward, a repeated hour, or both within three days.
			let start = new Date(zone.anchor).getTime();
			for (let expression of ZONE_SWEEP_EXPRESSIONS) {
				expectWalksAgree(expression, {
					timeZone: zone.timeZone,
					from: new Date(start - DAY_MS).toISOString(),
					until: new Date(start + 2 * DAY_MS).toISOString(),
				});
			}
		});

		test("keeps an hourly schedule on the hour, an hour apart except where the clock moved", () => {
			// An interval is followed on absolute time, and every run still has to read as
			// minute zero locally. Two runs are an hour apart unless the offset moved between
			// them, which is the only thing that can put the wall clock's zero minute
			// elsewhere: Lord Howe shifts by thirty minutes, so its gap is ninety.
			let { timeZone } = zone;
			let schedule = unwrap(Schedule.parse("0 * * * *"));
			let format = new Intl.DateTimeFormat("en-GB", { timeZone, minute: "2-digit" });
			let cursor = new Date(new Date(zone.anchor).getTime() - DAY_MS);
			let wrongMinute: string[] = [];
			let unexplained: string[] = [];
			let offHour = 0;

			for (let taken = 0; taken < 7 * 24; taken++) {
				let occurrence = schedule.next({ from: cursor, timeZone });
				if (Number.isNaN(occurrence.getTime())) break;
				if (Number(format.format(occurrence)) !== 0) wrongMinute.push(occurrence.toISOString());
				if (taken > 0 && occurrence.getTime() - cursor.getTime() !== 3_600_000) {
					offHour += 1;
					if (offsetAt(occurrence.getTime(), timeZone) === offsetAt(cursor.getTime(), timeZone)) {
						unexplained.push(occurrence.toISOString());
					}
				}
				cursor = occurrence;
			}

			// A week holds at most one transition, so at most one gap can be off an hour.
			expect({ timeZone, wrongMinute, unexplained, tooMany: offHour > 1 }).toEqual({
				timeZone,
				wrongMinute: [],
				unexplained: [],
				tooMany: false,
			});
		});
	},
);

describe("a whole year, in every zone", () => {
	test("gives a daily schedule exactly one run on every local calendar day", () => {
		// The property a zone that transitions at midnight breaks in other libraries: a day
		// with no 00:00 loses its run, and a day with two keeps only one. Counted off the
		// local date of each run, so a duplicate and a gap are both failures. A year covers
		// every transition each zone has, including the four Casablanca makes.
		for (let { timeZone, note } of ZONE_CASES) {
			let schedule = unwrap(Schedule.parse("@daily"));
			let format = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" });
			let cursor = new Date(Date.UTC(2025, 11, 31));
			let days: string[] = [];

			for (let taken = 0; taken < 370; taken++) {
				let occurrence = schedule.next({ from: cursor, timeZone });
				if (Number.isNaN(occurrence.getTime())) break;
				days.push(format.format(occurrence));
				cursor = occurrence;
			}

			expect({ timeZone, note, runs: days.length, distinct: new Set(days).size }).toEqual({
				timeZone,
				note,
				runs: 370,
				distinct: 370,
			});
		}
	});
});

describe("a zone the runtime cannot use", () => {
	test("reports no occurrence rather than throwing, from every entry point", () => {
		let schedule = unwrap(Schedule.parse("0 9 * * *"));
		let from = new Date("2026-06-15T00:00:00Z");

		for (let timeZone of UNKNOWN_ZONES) {
			expect({
				timeZone,
				next: schedule.next({ from, timeZone }).getTime(),
				prev: schedule.prev({ from, timeZone }).getTime(),
				batch: schedule.next({ from, timeZone, count: 3 }),
				matches: schedule.matches(from, { timeZone }),
				expectedBy: schedule.expectedBy(from, { timeZone }).getTime(),
				isDue: schedule.isDue(from, { now: new Date("2027-01-01T00:00:00Z"), timeZone }),
			}).toEqual({
				timeZone,
				next: Number.NaN,
				prev: Number.NaN,
				batch: [],
				matches: false,
				expectedBy: Number.NaN,
				isDue: false,
			});
		}
	});

	test("reads a zone name whatever case it is written in", () => {
		// The runtime canonicalizes a zone name, so a stored zone that changed case still
		// resolves; only a name that is not a zone at all fails.
		let schedule = unwrap(Schedule.parse("0 9 * * *"));
		let from = new Date("2026-06-15T00:00:00Z");
		let expected = schedule.next({ from, timeZone: "America/New_York" }).toISOString();

		for (let timeZone of ["america/new_york", "AMERICA/NEW_YORK", "America/New_York"]) {
			expect({ timeZone, next: schedule.next({ from, timeZone }).toISOString() }).toEqual({
				timeZone,
				next: expected,
			});
		}
	});

	test("reports no occurrence for a start that is not an instant", () => {
		let schedule = unwrap(Schedule.parse("0 9 * * *"));
		for (let from of [new Date(Number.NaN), new Date(8.64e15 + 1), new Date("nonsense")]) {
			expect({
				next: schedule.next({ from, timeZone: "UTC" }).getTime(),
				prev: schedule.prev({ from, timeZone: "UTC" }).getTime(),
				batch: schedule.next({ from, timeZone: "UTC", count: 2 }),
			}).toEqual({ next: Number.NaN, prev: Number.NaN, batch: [] });
		}
	});
});
