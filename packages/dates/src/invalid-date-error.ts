/**
 * The failure value `parseDate()` reports for malformed date input. Surfacing
 * it as a named failure at the boundary keeps a silent `NaN` from an `Invalid
 * Date` reaching later arithmetic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error for input rejected during date parsing, carried inside a `Failure`
 * value for the caller to inspect.
 */
export class InvalidDateError extends Error {
	/** The rejected input, kept verbatim for diagnostics. */
	readonly input: string | number;

	/**
	 * Builds an error whose message quotes the rejected input, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param input - The date-like value rejected by the parser.
	 */
	constructor(input: string | number) {
		super(`Invalid date: ${JSON.stringify(input)}`);
		this.name = "InvalidDateError";
		this.input = input;
	}
}
