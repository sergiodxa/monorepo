/**
 * The error raised when a tag, or a list of them, cannot be turned into a header
 * value. Throwing it at the point the tag is built surfaces a mistake in the
 * calling code immediately, ahead of the platform's own handling, which drops
 * an unusable tag silently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing a tag the platform would reject, or a tag list that cannot be
 * serialized. The offending tag stays on the error so a log line can name it.
 */
export class CacheTagError extends Error {
	/** The rejected tag, or `undefined` when the whole list was rejected. */
	readonly tag: string | undefined;

	/**
	 * Builds an error whose message quotes the rejected tag, so whitespace and
	 * empty strings stay visible wherever the throw is reported.
	 *
	 * @param message - What is wrong, phrased for the developer who wrote the tag.
	 * @param tag - The rejected tag, omitted when the list itself was the problem.
	 */
	constructor(message: string, tag?: string) {
		super(tag === undefined ? message : `${message} (${JSON.stringify(tag)})`);
		this.name = "CacheTagError";
		this.tag = tag;
	}
}
