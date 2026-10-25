/**
 * The failure for a string that is not a well-formed, well-typed RFC 9535 query, with the
 * offset where reading stopped so a caller can point at the problem.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A query RFC 9535 rejects: bad syntax, an out-of-range integer, or an ill-typed function call. */
export class JsonPathSyntaxError extends Error {
	override name = "JsonPathSyntaxError";

	/** UTF-16 offset into the query where the problem was found. */
	readonly offset: number;

	/**
	 * @param offset - Where the problem was found.
	 * @param message - What was expected there.
	 */
	constructor(offset: number, message: string) {
		super(`${message} (at offset ${offset})`);
		this.offset = offset;
	}
}
