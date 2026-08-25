/**
 * The one place test expressions come from: an exhaustive enumeration of every shape
 * a single field accepts, an independent expansion of a shape into the values it
 * stands for, and a seeded generator of whole expressions. Producing them here is
 * what makes a fuzz failure reproducible and keeps every test file on one corpus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CronFieldSet } from "../fields";
import type { CronFieldName } from "../types";

/** Bounds and vocabulary of one cron field, as the enumeration reads them. */
export interface FieldSpec {
	/** Which field this is, matching what a parse failure reports. */
	field: CronFieldName;
	/** Where the field's values live on a parse result, for reading them back. */
	set: "minutes" | "hours" | "daysOfMonth" | "months" | "daysOfWeek";
	/** Position in an expression, minute first, so a form can be placed in one. */
	index: number;
	/** Smallest value the field accepts. */
	min: number;
	/** Largest value the field accepts as written, which is `7` for day of week. */
	max: number;
	/** Largest value the field's set can hold, after day of week folds `7` to `0`. */
	limit: number;
	/** Abbreviations in value order starting at `min`, or `null` for numeric fields. */
	names: readonly string[] | null;
}

/** The five fields in expression order, with what each one accepts. */
export const FIELD_SPECS: readonly FieldSpec[] = [
	{ field: "minute", set: "minutes", index: 0, min: 0, max: 59, limit: 59, names: null },
	{ field: "hour", set: "hours", index: 1, min: 0, max: 23, limit: 23, names: null },
	{ field: "dayOfMonth", set: "daysOfMonth", index: 2, min: 1, max: 31, limit: 31, names: null },
	{
		field: "month",
		set: "months",
		index: 3,
		min: 1,
		max: 12,
		limit: 12,
		names: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
	},
	{
		field: "dayOfWeek",
		set: "daysOfWeek",
		index: 4,
		min: 0,
		max: 7,
		limit: 6,
		names: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
	},
];

/** The field spec by name, so a test block can read as prose. */
export function specFor(field: CronFieldName): FieldSpec {
	let spec = FIELD_SPECS.find((candidate) => candidate.field === field);
	if (spec === undefined) throw new Error(`no spec for ${field}`);
	return spec;
}

/**
 * The values a parse result holds for one field.
 *
 * @param fields - A parsed expression.
 * @param spec - Which field to read.
 * @returns That field's values, sorted as the parser leaves them.
 */
export function valuesOf(fields: CronFieldSet, spec: FieldSpec): readonly number[] {
	return fields[spec.set];
}

/**
 * Every shape a field accepts, grouped by the grammar rule it exercises, so a failing
 * test names which rule broke rather than only which string did.
 */
export interface FieldForms {
	/** Every single value in the field's range, `7` for day of week included. */
	singles: readonly string[];
	/** Every contiguous range `a-b` with `a <= b`. */
	ranges: readonly string[];
	/** `*` with every step from one to the width of the range. */
	starSteps: readonly string[];
	/** `a-b/n` over a spread of starts and steps rather than every pair. */
	rangeSteps: readonly string[];
	/** `a/n`, a step written on a single value, which runs to the field maximum. */
	valueSteps: readonly string[];
	/** Every abbreviation the field knows, upper, lower, and mixed case. */
	names: readonly string[];
	/** Every range written with abbreviations on both ends. */
	nameRanges: readonly string[];
}

/**
 * Enumerate every form a field accepts. Sizes are bounded by the field itself: the
 * minute field's ranges are the largest group at 1,830 entries, which is small enough
 * to run every one rather than sample.
 *
 * @param spec - The field to enumerate.
 * @returns Every accepted form, grouped by grammar rule.
 */
export function formsFor(spec: FieldSpec): FieldForms {
	let span = spec.max - spec.min + 1;
	let singles: string[] = [];
	let ranges: string[] = [];
	let starSteps: string[] = [];
	let rangeSteps: string[] = [];
	let valueSteps: string[] = [];
	let names: string[] = [];
	let nameRanges: string[] = [];

	for (let value = spec.min; value <= spec.max; value++) {
		singles.push(`${value}`);
		for (let end = value; end <= spec.max; end++) ranges.push(`${value}-${end}`);
		for (let step of [1, 2, 3, 5, span]) rangeSteps.push(`${value}-${spec.max}/${step}`);
		valueSteps.push(`${value}/3`);
	}

	for (let step = 1; step <= span; step++) starSteps.push(`*/${step}`);

	for (let [from, name] of (spec.names ?? []).entries()) {
		names.push(name, name.toLowerCase(), `${name[0]}${name.slice(1).toLowerCase()}`);
		for (let to = from; to < (spec.names?.length ?? 0); to++) {
			nameRanges.push(`${name}-${spec.names?.[to]}`);
		}
	}

	return { singles, ranges, starSteps, rangeSteps, valueSteps, names, nameRanges };
}

/** Every form of a field in one list, for a sweep that does not care which rule it is. */
export function everyFormOf(spec: FieldSpec): readonly string[] {
	let forms = formsFor(spec);
	return [
		"*",
		...forms.singles,
		...forms.ranges,
		...forms.starSteps,
		...forms.rangeSteps,
		...forms.valueSteps,
		...forms.names,
		...forms.nameRanges,
	];
}

/**
 * Place a field form into an expression whose other four fields are open, so what is
 * asserted about the result can only have come from the field under test.
 *
 * @param spec - The field the form belongs to.
 * @param form - The field text.
 * @returns The five-field expression.
 *
 * @example
 * expressionWith(specFor("hour"), "9-17/4"); // "* 9-17/4 * * *"
 */
export function expressionWith(spec: FieldSpec, form: string): string {
	let fields = ["*", "*", "*", "*", "*"];
	fields[spec.index] = form;
	return fields.join(" ");
}

/**
 * The values a field form stands for, worked out from the grammar here rather than by
 * asking the package. A test comparing this with the parser is comparing two
 * implementations of the same rule, which is the only way that comparison can fail.
 *
 * @param spec - The field the form belongs to.
 * @param form - The field text, which may be a comma-separated list.
 * @returns The values, sorted and deduplicated, with day of week's `7` folded to `0`.
 *
 * @example
 * expectedValues(specFor("minute"), "5/10"); // [5, 15, 25, 35, 45, 55]
 */
export function expectedValues(spec: FieldSpec, form: string): number[] {
	let values = new Set<number>();

	for (let item of form.split(",")) {
		let [rangeText = "", stepText] = item.split("/");
		let step = stepText === undefined ? 1 : Number(stepText);
		let start = spec.min;
		let end = spec.max;

		if (rangeText !== "*") {
			let bounds = rangeText.split("-").map((bound) => valueOf(spec, bound));
			let [first = spec.min, second] = bounds;
			start = first;
			end = second ?? (stepText === undefined ? first : spec.max);
		}

		for (let value = start; value <= end; value += step) {
			values.add(value > spec.limit ? value % (spec.limit + 1) : value);
		}
	}

	return [...values].sort((left, right) => left - right);
}

/**
 * Read one bound of a form, resolving an abbreviation to its number.
 *
 * @param spec - The field the bound belongs to.
 * @param text - The bound as written.
 * @returns The numeric value.
 */
function valueOf(spec: FieldSpec, text: string): number {
	if (/^\d+$/.test(text)) return Number(text);
	let index = spec.names?.findIndex((name) => name === text.toUpperCase()) ?? -1;
	if (index < 0) throw new Error(`not a value of ${spec.field}: ${text}`);
	return spec.min + index;
}

/** Every `@` shorthand the package accepts, with the expression it stands for. */
export const MACROS: readonly { readonly macro: string; readonly expands: string }[] = [
	{ macro: "@hourly", expands: "0 * * * *" },
	{ macro: "@daily", expands: "0 0 * * *" },
	{ macro: "@midnight", expands: "0 0 * * *" },
	{ macro: "@weekly", expands: "0 0 * * 0" },
	{ macro: "@monthly", expands: "0 0 1 * *" },
	{ macro: "@yearly", expands: "0 0 1 1 *" },
	{ macro: "@annually", expands: "0 0 1 1 *" },
];

/**
 * The seed every generated corpus is drawn from. It is fixed so a failure reproduces:
 * the expression a run reports is the expression the next run produces.
 */
export const CORPUS_SEED = 0x5eed_1;

/**
 * How many expressions the generated corpus holds. Kept small enough that the whole
 * package's suite stays a few seconds; `CRON_FUZZ_ITERATIONS` raises it for a deeper
 * local sweep, though past roughly ten thousand a run also needs `--timeout` raised.
 */
export const CORPUS_SIZE = Number(process.env.CRON_FUZZ_ITERATIONS ?? 2_000);

/**
 * Characters that no cron parser accepts anywhere in a field. Injecting one is a way
 * to build a string that must be rejected, without having to know why.
 */
const INVALID_CHARACTERS = "%$~^&()=!;:|+.".split("");

/**
 * A deterministic pseudo-random source. `Math.random` would make a failing case
 * unreproducible, which is the one thing a fuzz corpus cannot afford.
 *
 * @param seed - Any integer; the same seed always yields the same sequence.
 * @returns A function returning the next value in `[0, 1)`.
 */
function randomFrom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b_79f5) >>> 0;
		let mixed = state;
		mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/**
 * An integer in an inclusive range.
 *
 * @param random - The seeded source.
 * @param min - Smallest value.
 * @param max - Largest value.
 * @returns The value.
 */
function between(random: () => number, min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

/**
 * One list item drawn from a slice of a field, as a value, a range, or either with a
 * step, written as a number or an abbreviation.
 *
 * @param random - The seeded source.
 * @param spec - The field being written.
 * @param low - Smallest value the item may name.
 * @param high - Largest value the item may name.
 * @returns The item text.
 */
function randomItem(random: () => number, spec: FieldSpec, low: number, high: number): string {
	let write = (value: number) => {
		let name = spec.names?.[value - spec.min];
		if (name !== undefined && random() < 0.3) return name;
		return `${value}`;
	};

	let shape = random();
	if (shape < 0.4 || low === high) return write(between(random, low, high));

	let start = between(random, low, high);
	let end = between(random, start, high);
	if (shape < 0.75) return `${write(start)}-${write(end)}`;
	return `${write(start)}-${write(end)}/${between(random, 1, high - low + 1)}`;
}

/**
 * One field: open, a star with a step, or a list of non-overlapping items, since parsers
 * disagree on overlapping items and only a non-overlapping list compares the same way
 * across them. Day-of-week's `7` alias for Sunday is pinned by name, since a step reads it differently elsewhere.
 *
 * @param random - The seeded source.
 * @param spec - The field being written.
 * @returns The field text.
 */
function randomField(random: () => number, spec: FieldSpec): string {
	let span = spec.limit - spec.min + 1;
	let shape = random();
	if (shape < 0.3) return "*";
	if (shape < 0.45) return `*/${between(random, 1, span)}`;

	let count = Math.min(between(random, 1, 3), span);
	let size = Math.floor(span / count);
	let items: string[] = [];

	for (let index = 0; index < count; index++) {
		let low = spec.min + index * size;
		let high = index === count - 1 ? spec.limit : low + size - 1;
		items.push(randomItem(random, spec, low, high));
	}

	return items.join(",");
}

/**
 * Longest each month can be, indexed by month number, February at its leap length.
 * Kept with the corpus rather than read from the package, so a test checking which
 * dates exist is checking against a calendar and not against the table under test.
 */
export const MONTH_LENGTHS: readonly number[] = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Whether some calendar year contains a date the day-of-month and month fields both
 * allow, e.g. the 31st of April never is.
 *
 * @param dayOfMonth - The day-of-month field as written.
 * @param month - The month field as written.
 * @returns `true` when at least one day and month pair exists on some calendar.
 */
function namesARealDate(dayOfMonth: string, month: string): boolean {
	let days = expectedValues(specFor("dayOfMonth"), dayOfMonth);
	let months = expectedValues(specFor("month"), month);
	return months.some((value) => days.some((day) => day <= (MONTH_LENGTHS[value] ?? 0)));
}

/**
 * One whole expression, its day of month redrawn until the date it names occurs on some
 * calendar, since a pair no year contains is enumerated separately in the rejection
 * sweep. Keeping this corpus valid is what lets it be compared run for run.
 *
 * @param random - The seeded source.
 * @returns The five fields separated by single spaces.
 */
function drawExpression(random: () => number): string {
	let drawn = FIELD_SPECS.map((spec) => randomField(random, spec));
	let [minute, hour, dayOfMonth = "*", month = "*", dayOfWeek] = drawn;

	for (let attempt = 0; attempt < 20 && !namesARealDate(dayOfMonth, month); attempt++) {
		dayOfMonth = randomField(random, specFor("dayOfMonth"));
	}
	if (!namesARealDate(dayOfMonth, month)) dayOfMonth = "*";

	return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

/**
 * A corpus of whole expressions combining lists, ranges, steps, and names across all
 * five fields, which is the part an enumeration cannot reach: the shapes only appear
 * together often enough to matter when they are drawn together.
 *
 * @param options - The seed and how many expressions to draw.
 * @returns The expressions, in generation order.
 *
 * @example
 * randomExpressions({ seed: CORPUS_SEED, count: 10 });
 */
export function randomExpressions(options: { seed: number; count: number }): string[] {
	let random = randomFrom(options.seed);
	let expressions: string[] = [];
	for (let index = 0; index < options.count; index++) expressions.push(drawExpression(random));
	return expressions;
}

/**
 * A corpus of strings no cron parser accepts, built by dropping a character that is
 * not part of the grammar into an otherwise valid expression. Built this way the
 * expected answer is known without a table: every one of them must be rejected.
 *
 * @param options - The seed and how many strings to draw.
 * @returns The strings, in generation order.
 */
export function randomInvalidExpressions(options: { seed: number; count: number }): string[] {
	let random = randomFrom(options.seed);
	let corpus: string[] = [];

	for (let index = 0; index < options.count; index++) {
		let valid = drawExpression(random);
		let at = between(random, 0, valid.length);
		let character = INVALID_CHARACTERS[between(random, 0, INVALID_CHARACTERS.length - 1)] ?? "%";
		corpus.push(`${valid.slice(0, at)}${character}${valid.slice(at)}`);
	}

	return corpus;
}

/**
 * Instants a search starts from, chosen to land on a month end, a leap day, a year
 * boundary, and an ordinary afternoon, so a walk crosses each of those while it runs.
 */
export const ANCHORS: readonly string[] = [
	"2026-01-01T00:00:00Z",
	"2026-02-28T23:59:00Z",
	"2026-06-15T12:00:00Z",
	"2026-12-31T23:30:00Z",
	"2028-02-29T12:00:00Z",
	"2025-07-04T08:22:00Z",
];

/** A zone to evaluate in, with what makes it worth evaluating in. */
export interface ZoneCase {
	timeZone: string;
	/** Why this zone is in the table, so nobody drops it as a duplicate. */
	note: string;
	/** An instant a few hours before something interesting happens in the zone. */
	anchor: string;
}

/**
 * The zones every occurrence property is checked in. The set spans positive, negative,
 * half-hour, three-quarter-hour, and fixed offsets across both hemispheres, plus
 * transitions at midnight, of thirty minutes, of two hours, and four times a year.
 */
export const ZONE_CASES: readonly ZoneCase[] = [
	{ timeZone: "UTC", note: "no offset and no transitions", anchor: "2026-03-08T00:00:00Z" },
	{
		timeZone: "America/New_York",
		note: "negative offset, transition at 02:00 local",
		anchor: "2026-03-08T04:00:00Z",
	},
	{
		timeZone: "Europe/London",
		note: "zero offset in winter, transition at 01:00 local",
		anchor: "2026-03-29T00:00:00Z",
	},
	{
		timeZone: "Australia/Sydney",
		note: "positive offset, southern hemisphere so the transitions invert",
		anchor: "2026-10-03T14:00:00Z",
	},
	{
		timeZone: "Asia/Kolkata",
		note: "fixed half-hour offset, no transitions at all",
		anchor: "2026-06-15T00:00:00Z",
	},
	{
		timeZone: "Asia/Kathmandu",
		note: "fixed three-quarter-hour offset",
		anchor: "2026-06-15T00:00:00Z",
	},
	{
		timeZone: "Pacific/Chatham",
		note: "offset 45 minutes off the hour, and it transitions",
		anchor: "2026-09-26T12:00:00Z",
	},
	{
		timeZone: "Australia/Lord_Howe",
		note: "the only zone whose transition is 30 minutes",
		anchor: "2026-10-03T14:00:00Z",
	},
	{
		timeZone: "America/Santiago",
		note: "transitions at midnight, so a day both loses and repeats its edge",
		anchor: "2026-04-04T20:00:00Z",
	},
	{
		timeZone: "Africa/Cairo",
		note: "starts daylight saving at midnight, so a day has no 00:00",
		anchor: "2026-04-23T20:00:00Z",
	},
	{
		timeZone: "America/Havana",
		note: "ends daylight saving at midnight, so a day has two 00:00s",
		anchor: "2026-11-01T02:00:00Z",
	},
	{
		timeZone: "Antarctica/Troll",
		note: "the largest transition in use, two whole hours",
		anchor: "2026-03-28T22:00:00Z",
	},
	{
		timeZone: "Africa/Casablanca",
		note: "four transitions a year, around Ramadan",
		anchor: "2026-03-22T00:00:00Z",
	},
	{
		timeZone: "Pacific/Kiritimati",
		note: "the furthest offset ahead of UTC in use, +14",
		anchor: "2026-06-15T00:00:00Z",
	},
	{
		timeZone: "Pacific/Niue",
		note: "a long way behind UTC, -11, with no transitions",
		anchor: "2026-06-15T00:00:00Z",
	},
	{
		timeZone: "America/St_Johns",
		note: "negative half-hour offset that also transitions",
		anchor: "2026-03-08T04:00:00Z",
	},
];

/**
 * Expressions the zone sweep walks, one per shape the search treats differently — an
 * interval, a wall-clock appointment, each transition hour, and a date-only case — each
 * firing at least once in any three consecutive days, so no window is vacuous.
 */
export const ZONE_SWEEP_EXPRESSIONS: readonly string[] = [
	"0 * * * *",
	"*/20 * * * *",
	"0 0 * * *",
	"30 0 * * *",
	"30 1 * * *",
	"30 2 * * *",
	"0 9 * * 1-5",
	"0 0,12 * * *",
	"0 * */2 * *",
	"0 * 2-30/2 * *",
	"15 3 */2 * *",
];

/**
 * Zone strings the runtime rejects, for pinning what an unusable zone does. Case is
 * not one of them: the runtime canonicalizes a zone name, so a shouted or whispered
 * one is the same zone, while a stray space or an ISO designator is not a zone at all.
 */
export const UNKNOWN_ZONES: readonly string[] = [
	"Nowhere/Land",
	"Mars/Olympus_Mons",
	"not a zone",
	"",
	"utc/",
	"America/New_York ",
	"Z",
	"UTC+2",
];
