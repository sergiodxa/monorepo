/**
 * Rendering a parsed schedule back as a five-field expression, for storage and
 * logs. Normalization is lossless where it counts: an expression written back and
 * read again fires on exactly the same minutes as the one it came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CronFieldSet } from "./fields.js";

import { stepFromStart } from "./describe.js";

/**
 * Render a parsed schedule as a normalized expression, with runs collapsed to
 * ranges. A day field naming every day still prints as a range rather than
 * `*`, since `*` would disable the day either-or rule and change which dates fire.
 *
 * @param fields - The parsed schedule.
 * @returns The five fields separated by single spaces.
 *
 * @example
 * normalizeExpression(fields); // "0 0 * * 0" for "@weekly"
 * @example
 * normalizeExpression(fields); // "5,15,25,35,45,55 * * * *" for "5/10 * * * *"
 */
export function normalizeExpression(fields: CronFieldSet): string {
	let minute = normalizeField(fields.minutes, 0, 59, false);
	let hour = normalizeField(fields.hours, 0, 23, false);
	let dayOfMonth = normalizeField(fields.daysOfMonth, 1, 31, fields.dayOfMonthRestricted);
	let month = normalizeField(fields.months, 1, 12, false);
	let dayOfWeek = normalizeField(fields.daysOfWeek, 0, 6, fields.dayOfWeekRestricted);
	return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

/**
 * Render one field's values in the shortest form that reads back the same.
 *
 * @param values - Sorted field values.
 * @param min - The field's smallest value.
 * @param max - The field's largest value.
 * @param keepRestricted - Whether printing `*` would change the expression's
 * meaning, which is true of a day field that took part in the either-or rule.
 * @returns The field text.
 */
function normalizeField(
	values: readonly number[],
	min: number,
	max: number,
	keepRestricted: boolean,
): string {
	if (values.length === max - min + 1) {
		return keepRestricted ? `${min}-${max}` : "*";
	}

	let step = stepFromStart(values, min, max);
	if (step !== null) return `*/${step}`;

	return collapseRuns(values);
}

/**
 * Join values as a list, writing three or more consecutive values as a range so a
 * weekday field reads `1-5` instead of `1,2,3,4,5`.
 *
 * @param values - Sorted field values.
 * @returns The comma-separated list.
 *
 * @example
 * collapseRuns([1, 2, 3, 4, 5]); // "1-5"
 * @example
 * collapseRuns([0, 30]); // "0,30"
 */
function collapseRuns(values: readonly number[]): string {
	let parts: string[] = [];
	let index = 0;

	while (index < values.length) {
		let start = values[index] ?? 0;
		let end = start;
		let next = index + 1;

		while (next < values.length && (values[next] ?? -1) === end + 1) {
			end = values[next] ?? end;
			next += 1;
		}

		if (end - start >= 2) parts.push(`${start}-${end}`);
		else for (let value = start; value <= end; value++) parts.push(`${value}`);

		index = next;
	}

	return parts.join(",");
}
