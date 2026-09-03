/**
 * The failure value parsing reports for text that is not a schedule this package
 * accepts. It keeps a machine-readable reason, the offending field, and the index
 * inside the original text, so an app can point a validation message at the typo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CronFieldName } from "./types.js";

/**
 * Why an expression was rejected, as a code an app maps to its own wording. A
 * `field-count` mismatch, `seconds-not-supported`, `unknown-macro`, and `empty`
 * describe the whole expression; every other reason belongs to one field.
 */
export type InvalidCronReason =
	| "empty"
	| "field-count"
	| "seconds-not-supported"
	| "unknown-macro"
	| "syntax"
	| "unknown-name"
	| "out-of-range"
	| "reversed-range"
	| "invalid-step"
	| "impossible-date";

/** Everything an `InvalidCronExpression` needs to describe where parsing stopped. */
export interface InvalidCronExpressionInput {
	expression: string;
	reason: InvalidCronReason;
	field: CronFieldName | null;
	position: number;
}

/**
 * Error describing an expression this package does not accept, returned inside a
 * `Failure` and never thrown. The message is diagnostic only: user-facing wording
 * comes from the app's i18n layer keyed on {@link InvalidCronExpression.reason}.
 */
export class InvalidCronExpression extends Error {
	/** The rejected text, kept verbatim so positions still line up with it. */
	readonly expression: string;

	/** Machine-readable cause, meant to be mapped to a translated message. */
	readonly reason: InvalidCronReason;

	/**
	 * The field the problem belongs to, or `null` when the expression as a whole
	 * is at fault (wrong number of fields, an unknown macro, empty text).
	 */
	readonly field: CronFieldName | null;

	/**
	 * Zero-based index into `expression` where the problem starts, so a caret or
	 * a text selection can be placed on it.
	 */
	readonly position: number;

	/**
	 * Builds the failure with the location parsing stopped at.
	 *
	 * @param input - The rejected expression plus the reason, field, and index.
	 */
	constructor(input: InvalidCronExpressionInput) {
		let where = input.field === null ? "" : ` in the ${input.field} field`;
		super(
			`Invalid cron expression ${JSON.stringify(input.expression)}: ${input.reason}${where} at position ${input.position}`,
		);
		this.name = "InvalidCronExpression";
		this.expression = input.expression;
		this.reason = input.reason;
		this.field = input.field;
		this.position = input.position;
	}
}
