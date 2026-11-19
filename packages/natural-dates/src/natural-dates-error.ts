/**
 * The failure `find` answers with when it cannot read a text at all, which only its options
 * cause: an unknown time zone, or a `now` that is not a valid date. Text without any date phrase
 * is not a failure; it finds nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Why `find` could not run: which option was wrong. */
export class NaturalDatesError extends Error {
	override name = "NaturalDatesError";

	/**
	 * @param problem The option at fault.
	 * @param message What was wrong with it.
	 */
	constructor(
		readonly problem: "timeZone" | "now",
		message: string,
	) {
		super(message);
	}
}
