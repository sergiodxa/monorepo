import { fail } from "remix/data-table";

let ISO_UTC_MILLIS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Checks whether a value is a valid ISO-8601 UTC timestamp with milliseconds.
 *
 * @param value Timestamp candidate in `YYYY-MM-DDTHH:mm:ss.sssZ` format.
 * @returns `true` when the value matches the expected shape and parses as a date.
 */
function isIsoUtcMillis(value: string) {
	if (!ISO_UTC_MILLIS_REGEX.test(value)) return false;
	return !Number.isNaN(Date.parse(value));
}

/**
 * Validates selected fields as ISO UTC timestamps.
 * Missing fields are ignored, and nullable fields accept `null`.
 *
 * @param value Record being validated.
 * @param fields Field contract with name and nullability rules.
 * @returns `fail(issues)` when any field is invalid; otherwise `{ value }`.
 */
export function validateTimestamps(
	value: Record<string, unknown>,
	fields: Array<{ name: string; nullable: boolean }>,
) {
	let issues: Array<{ message: string; path: Array<string> }> = [];

	for (let field of fields) {
		if (!(field.name in value)) continue;

		let fieldValue = value[field.name];
		if (field.nullable && fieldValue === null) continue;

		if (typeof fieldValue !== "string" || !isIsoUtcMillis(fieldValue)) {
			issues.push({
				message: `Expected ${field.name} to be an ISO UTC timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)`,
				path: [field.name],
			});
		}
	}

	if (issues.length > 0) return fail(issues);
	return { value };
}
