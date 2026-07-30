/**
 * The failure value `parseDate()` reports for input the platform cannot read as a
 * date. It exists so an unparseable value is a named failure at the boundary
 * instead of an `Invalid Date` that spreads `NaN` through later arithmetic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing input that does not name an instant. Returned inside a
 * `Failure` and never thrown.
 */
export class InvalidDateError extends Error {
	/** The rejected input, kept verbatim for diagnostics. */
	readonly input: string | number;

	/**
	 * Builds an error whose message quotes the rejected input, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param input - Value that could not be read as a date.
	 */
	constructor(input: string | number) {
		super(`Invalid date: ${JSON.stringify(input)}`);
		this.name = "InvalidDateError";
		this.input = input;
	}
}
