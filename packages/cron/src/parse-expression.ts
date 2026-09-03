/**
 * Whole-expression parsing: macro expansion, splitting the five standard fields,
 * and the checks that keep an accepted schedule one that can actually happen.
 * Everything reported here is a `Failure`, so validation never needs a try/catch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { CronFieldSet } from "./fields";

import { longestMonth } from "./calendar";
import { FIELD_SPECS, isRestrictedField, parseCronField } from "./fields";
import { InvalidCronExpression } from "./invalid-cron-expression";

/**
 * The `@` shorthands this package accepts, expanded to the five-field expression
 * they stand for. `@annually` and `@midnight` are the crontab spec's long spellings
 * of `@yearly` and `@daily`; shorthands with no schedule of their own are rejected.
 */
const MACROS: Record<string, string | undefined> = {
	"@hourly": "0 * * * *",
	"@daily": "0 0 * * *",
	"@midnight": "0 0 * * *",
	"@weekly": "0 0 * * 0",
	"@monthly": "0 0 1 * *",
	"@yearly": "0 0 1 1 *",
	"@annually": "0 0 1 1 *",
};

/** How many fields a standard expression has, seconds excluded by design. */
const FIELD_COUNT = 5;

/** A whitespace-separated field together with where it starts in the input. */
interface FieldToken {
	text: string;
	offset: number;
}

/**
 * Split an expression into its whitespace-separated fields, remembering where each
 * one starts so failures can point into the text the user actually typed.
 *
 * @param expression - Raw expression, untrimmed.
 * @returns One token per run of non-whitespace characters, in order.
 */
function tokenize(expression: string): FieldToken[] {
	let tokens: FieldToken[] = [];
	for (let match of expression.matchAll(/\S+/g))
		tokens.push({ text: match[0], offset: match.index });
	return tokens;
}

/**
 * Parse a cron expression into the value sets its fields stand for. Five fields
 * are required, since a sub-minute schedule is a promise the runtime cannot keep,
 * and non-standard extensions (`L`, `W`, `#`, `?`) imply semantics this rejects.
 *
 * @param expression - The expression as written, whitespace and case as typed.
 * @returns The field sets, or the first failure with its reason, field, and index.
 *
 * @example
 * parseExpression("0 9 * * 1-5"); // weekday mornings
 * @example
 * parseExpression("@daily"); // same as "0 0 * * *"
 * @example
 * parseExpression("* * * * * *"); // failure: seconds-not-supported
 */
export function parseExpression(expression: string): Result<CronFieldSet, InvalidCronExpression> {
	let tokens = tokenize(expression);

	if (tokens.length === 0) {
		return failure(
			new InvalidCronExpression({ expression, reason: "empty", field: null, position: 0 }),
		);
	}

	let first = tokens[0];
	if (first !== undefined && first.text.startsWith("@")) {
		let expanded = tokens.length === 1 ? MACROS[first.text.toLowerCase()] : undefined;
		if (expanded === undefined) {
			return failure(
				new InvalidCronExpression({
					expression,
					reason: "unknown-macro",
					field: null,
					position: first.offset,
				}),
			);
		}
		return parseFields(expression, tokenize(expanded));
	}

	if (tokens.length === FIELD_COUNT + 1) {
		return failure(
			new InvalidCronExpression({
				expression,
				reason: "seconds-not-supported",
				field: null,
				position: first?.offset ?? 0,
			}),
		);
	}

	if (tokens.length !== FIELD_COUNT) {
		let position =
			tokens.length < FIELD_COUNT
				? expression.trimEnd().length
				: (tokens[FIELD_COUNT]?.offset ?? 0);
		return failure(
			new InvalidCronExpression({ expression, reason: "field-count", field: null, position }),
		);
	}

	return parseFields(expression, tokens);
}

/**
 * Expand five already-counted fields and check the result can occur.
 *
 * @param expression - The original expression, quoted in failures. Macro input
 * keeps its own text here, so a position still refers to what the user typed.
 * @param tokens - Exactly five field tokens, in expression order.
 * @returns The field sets, or the first failure.
 */
function parseFields(
	expression: string,
	tokens: FieldToken[],
): Result<CronFieldSet, InvalidCronExpression> {
	let sets: (readonly number[])[] = [];

	for (let index = 0; index < FIELD_COUNT; index++) {
		let spec = FIELD_SPECS[index];
		let token = tokens[index];
		if (spec === undefined || token === undefined) {
			return failure(
				new InvalidCronExpression({
					expression,
					reason: "field-count",
					field: null,
					position: expression.trimEnd().length,
				}),
			);
		}

		let parsed = parseCronField(spec, expression, token.text, token.offset);
		if (isFailure(parsed)) return parsed;
		sets.push(parsed.data);
	}

	let [minutes = [], hours = [], daysOfMonth = [], months = [], daysOfWeek = []] = sets;
	let dayOfMonthRestricted = isRestrictedField(tokens[2]?.text ?? "*");
	let dayOfWeekRestricted = isRestrictedField(tokens[4]?.text ?? "*");

	if (dayOfMonthRestricted && !dayOfWeekRestricted && !isReachable(daysOfMonth, months)) {
		return failure(
			new InvalidCronExpression({
				expression,
				reason: "impossible-date",
				field: "dayOfMonth",
				position: tokens[2]?.offset ?? 0,
			}),
		);
	}

	return success({
		minutes,
		hours,
		daysOfMonth,
		months,
		daysOfWeek,
		dayOfMonthRestricted,
		dayOfWeekRestricted,
	});
}

/**
 * Whether any month the schedule allows is long enough for any day it allows, e.g.
 * the 30th of February never is. Only meaningful when the day of week is open,
 * because a restricted day of week can match a date the day of month never does.
 *
 * @param daysOfMonth - Allowed day-of-month values.
 * @param months - Allowed month numbers.
 * @returns `true` when at least one day and month pair exists on some calendar.
 */
function isReachable(daysOfMonth: readonly number[], months: readonly number[]): boolean {
	return months.some((month) => daysOfMonth.some((day) => day <= longestMonth(month)));
}
