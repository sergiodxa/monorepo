/**
 * The field grammar: one cron field of comma-separated values, ranges, and steps
 * expanded into the sorted set of numbers it stands for. Every rejection carries
 * the index inside the original expression, which is why offsets travel with text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { InvalidCronReason } from "./invalid-cron-expression";
import type { CronFieldName } from "./types";

import { InvalidCronExpression } from "./invalid-cron-expression";

/** Month abbreviations cron accepts, lowercased, mapped to month numbers. */
const MONTH_NAMES: Record<string, number | undefined> = {
	jan: 1,
	feb: 2,
	mar: 3,
	apr: 4,
	may: 5,
	jun: 6,
	jul: 7,
	aug: 8,
	sep: 9,
	oct: 10,
	nov: 11,
	dec: 12,
};

/** Weekday abbreviations cron accepts, lowercased, with Sunday at `0`. */
const WEEKDAY_NAMES: Record<string, number | undefined> = {
	sun: 0,
	mon: 1,
	tue: 2,
	wed: 3,
	thu: 4,
	fri: 5,
	sat: 6,
};

/** A single value: digits only, so `+1`, `1.5` and `0x1` never match. */
const VALUE_PATTERN = /^\d+$/;

/** A name: letters only, told apart from a typo so the reason can say which. */
const NAME_PATTERN = /^[a-z]+$/i;

/** The bounds and name table a field's values are checked against. */
export interface CronFieldSpec {
	/** Which field this is, carried into failures. */
	field: CronFieldName;
	min: number;
	/** Largest value the field accepts, before any folding. */
	max: number;
	/** Largest value the field's set can hold, after folding (day of week). */
	limit: number;
	/** Accepted abbreviations, or `null` for numeric-only fields. */
	names: Record<string, number | undefined> | null;
}

/**
 * The five fields in expression order with their accepted values. Day of week
 * takes `7` for Sunday as well as `0`, and folds it to `0`, which is why its
 * parsing bound and its set bound differ.
 */
export const FIELD_SPECS: readonly CronFieldSpec[] = [
	{ field: "minute", min: 0, max: 59, limit: 59, names: null },
	{ field: "hour", min: 0, max: 23, limit: 23, names: null },
	{ field: "dayOfMonth", min: 1, max: 31, limit: 31, names: null },
	{ field: "month", min: 1, max: 12, limit: 12, names: MONTH_NAMES },
	{ field: "dayOfWeek", min: 0, max: 7, limit: 6, names: WEEKDAY_NAMES },
];

/**
 * A parsed expression: the values each field stands for, plus whether the two day
 * fields were written as anything other than `*`. That distinction decides how a
 * date is matched, so parsing records it once alongside the value sets.
 */
export interface CronFieldSet {
	minutes: readonly number[];
	hours: readonly number[];
	daysOfMonth: readonly number[];
	months: readonly number[];
	daysOfWeek: readonly number[];
	dayOfMonthRestricted: boolean;
	dayOfWeekRestricted: boolean;
}

/**
 * Whether a field narrows the dates a schedule can fire on. Only a bare `*` leaves
 * a field open: a star with a step names specific days, so it takes part in the
 * either-or rule the two day fields follow.
 *
 * @param text - The field as written.
 * @returns `true` for anything other than `*`.
 */
export function isRestrictedField(text: string): boolean {
	return text !== "*";
}

/**
 * Expand one cron field into the sorted, deduplicated values it stands for.
 *
 * @param spec - Bounds and names for the field being parsed.
 * @param expression - The whole expression, kept so failures can quote it.
 * @param text - The field as written.
 * @param offset - Index of `text` inside `expression`, added to every reported
 * position so a caret lands on the offending character and not on the field.
 * @returns The field's values, or the first failure found reading left to right.
 *
 * @example
 * parseCronField(FIELD_SPECS[0], "0,30 * * * *", "0,30", 0); // [0, 30]
 */
export function parseCronField(
	spec: CronFieldSpec,
	expression: string,
	text: string,
	offset: number,
): Result<readonly number[], InvalidCronExpression> {
	let values = new Set<number>();
	let cursor = 0;

	for (let item of text.split(",")) {
		let itemOffset = offset + cursor;
		cursor += item.length + 1;

		let parsed = parseItem(spec, expression, item, itemOffset);
		if (isFailure(parsed)) return parsed;
		for (let value of parsed.data) values.add(value);
	}

	return success([...values].sort((left, right) => left - right));
}

/**
 * Expand one comma-separated item: `*`, a value, a range, or any of those with a
 * `/step` suffix. A step written on a single value runs from it to the field's
 * maximum, which is how `5/10` reaches every tenth minute from the fifth.
 *
 * @param spec - Bounds and names for the field being parsed.
 * @param expression - The whole expression, for the failure message.
 * @param text - The item as written.
 * @param offset - Index of `text` inside `expression`.
 * @returns The item's values, or a failure pointing inside the item.
 */
function parseItem(
	spec: CronFieldSpec,
	expression: string,
	text: string,
	offset: number,
): Result<number[], InvalidCronExpression> {
	let slices = text.split("/");
	if (slices.length > 2) {
		let position = offset + (slices[0]?.length ?? 0) + (slices[1]?.length ?? 0) + 1;
		return failure(fail(spec, expression, "invalid-step", position));
	}

	let rangeText = slices[0] ?? "";
	let stepText = slices[1];
	let step = 1;

	if (stepText !== undefined) {
		let stepPosition = offset + rangeText.length + 1;
		if (!VALUE_PATTERN.test(stepText)) {
			return failure(fail(spec, expression, "invalid-step", stepPosition));
		}
		step = Number(stepText);
		if (step === 0) return failure(fail(spec, expression, "invalid-step", stepPosition));
	}

	let start = spec.min;
	let end = spec.max;

	if (rangeText !== "*") {
		let bounds = rangeText.split("-");
		if (bounds.length > 2) {
			let position = offset + (bounds[0]?.length ?? 0) + (bounds[1]?.length ?? 0) + 1;
			return failure(fail(spec, expression, "syntax", position));
		}

		let first = parseValue(spec, expression, bounds[0] ?? "", offset);
		if (isFailure(first)) return first;

		if (bounds.length === 1) {
			start = first.data;
			end = stepText === undefined ? first.data : spec.max;
		} else {
			let secondOffset = offset + (bounds[0]?.length ?? 0) + 1;
			let second = parseValue(spec, expression, bounds[1] ?? "", secondOffset);
			if (isFailure(second)) return second;
			if (first.data > second.data) {
				return failure(fail(spec, expression, "reversed-range", offset));
			}
			start = first.data;
			end = second.data;
		}
	}

	let values: number[] = [];
	for (let value = start; value <= end; value += step) values.push(fold(spec, value));
	return success(values);
}

/**
 * Read a single value, numeric or named, and check it against the field's bounds.
 *
 * @param spec - Bounds and names for the field being parsed.
 * @param expression - The whole expression, for the failure message.
 * @param text - The value as written.
 * @param offset - Index of `text` inside `expression`.
 * @returns The value, unfolded, or a failure telling apart an unknown name from a
 * value out of range and from text that is not a value at all.
 */
function parseValue(
	spec: CronFieldSpec,
	expression: string,
	text: string,
	offset: number,
): Result<number, InvalidCronExpression> {
	if (VALUE_PATTERN.test(text)) {
		let value = Number(text);
		if (value < spec.min || value > spec.max) {
			return failure(fail(spec, expression, "out-of-range", offset));
		}
		return success(value);
	}

	if (spec.names !== null && NAME_PATTERN.test(text)) {
		let named = spec.names[text.toLowerCase()];
		if (named === undefined) return failure(fail(spec, expression, "unknown-name", offset));
		return success(named);
	}

	if (NAME_PATTERN.test(text)) return failure(fail(spec, expression, "unknown-name", offset));
	return failure(fail(spec, expression, "syntax", offset));
}

/**
 * Fold a parsed value into the range the value set uses, which only affects day of
 * week, where `7` and `0` both mean Sunday.
 *
 * @param spec - The field the value belongs to.
 * @param value - The value as written.
 * @returns The value at or below the field's set bound.
 */
function fold(spec: CronFieldSpec, value: number): number {
	if (value <= spec.limit) return value;
	return value % (spec.limit + 1);
}

/**
 * Build a field failure, so every rejection in this module reports the same shape.
 *
 * @param spec - The field being parsed.
 * @param expression - The whole expression.
 * @param reason - Machine-readable cause.
 * @param position - Index inside `expression`.
 * @returns The error to return inside a `Failure`.
 */
function fail(
	spec: CronFieldSpec,
	expression: string,
	reason: InvalidCronReason,
	position: number,
): InvalidCronExpression {
	return new InvalidCronExpression({ expression, reason, field: spec.field, position });
}
