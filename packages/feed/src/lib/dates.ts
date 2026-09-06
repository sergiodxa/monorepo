/**
 * Converts the date text a feed carries into a `Date`. RSS writes RFC 822 and
 * Atom writes RFC 3339; the platform parses both, so the work here is refusing
 * the values it does not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Reads a feed's date text.
 *
 * An unparseable value reports `undefined` rather than an `Invalid Date`, so a
 * consumer that stores or formats the result never has to test for one.
 *
 * @param value - The date text a feed carried
 * @returns The date, or `undefined` when there is none to read
 */
export function toDate(value?: string): Date | undefined {
	if (!value) return undefined;

	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;
	return date;
}
