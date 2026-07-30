/**
 * Runtime parsing for durations that arrive as text — configuration values, form
 * input — where the compile-time type cannot help. The grammar mirrors
 * `DurationString`, and a mismatch is a `Result` failure instead of a throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import { InvalidDurationError } from "./invalid-duration-error";
import { longUnitToMs, shortUnitToMs } from "./units";

/**
 * An amount, one space, then a long unit spelling: `"5 minutes"`. The amount is
 * a whole number in canonical form, so `"1.5"`, `"5e3"` and `"05"` never match.
 */
const SPACED_PATTERN = /^(?<amount>-?(?:0|[1-9][0-9]*)) (?<unit>[a-z]+)$/;

/**
 * An amount followed by an optional short alias: `"30s"`, or `"1800000"` for a
 * bare amount, which is milliseconds like every other bare number here.
 */
const COMPACT_PATTERN = /^(?<amount>-?(?:0|[1-9][0-9]*))(?<unit>[a-z]*)$/;

/**
 * Parse duration text into milliseconds, accepting exactly the forms
 * `DurationString` allows plus a bare amount of milliseconds, with surrounding
 * whitespace trimmed.
 *
 * A long spelling requires the single space and a short alias requires none, so
 * `"5 m"` and `"5minutes"` are failures: the runtime grammar stays the mirror of
 * the type, and text a call site could not have written is never accepted here.
 *
 * @param text - Text to parse, e.g. an environment variable value.
 * @returns The duration in milliseconds, or an `InvalidDurationError` naming the
 * rejected text.
 *
 * @example
 * parse("15 minutes"); // { status: "success", data: 900000 }
 * @example
 * parse("15 minuts"); // { status: "failure", error: InvalidDurationError }
 * @example
 * parse("900000"); // { status: "success", data: 900000 }
 */
export function parse(text: string): Result<number, InvalidDurationError> {
	let trimmed = text.trim();

	let spaced = SPACED_PATTERN.exec(trimmed)?.groups;
	if (spaced?.amount && spaced.unit) {
		let unitMs = longUnitToMs(spaced.unit);
		if (unitMs === undefined) return failure(new InvalidDurationError(text));
		return success(Number(spaced.amount) * unitMs);
	}

	let compact = COMPACT_PATTERN.exec(trimmed)?.groups;
	if (compact?.amount) {
		if (!compact.unit) return success(Number(compact.amount));
		let unitMs = shortUnitToMs(compact.unit);
		if (unitMs !== undefined) return success(Number(compact.amount) * unitMs);
	}

	return failure(new InvalidDurationError(text));
}
