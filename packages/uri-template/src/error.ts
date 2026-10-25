/**
 * The failure for a template RFC 6570 rejects, or a value it cannot expand, with the offset
 * into the template where the problem lies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A malformed template, or a prefix modifier applied to a list or associative array. */
export class UriTemplateError extends Error {
	override name = "UriTemplateError";

	/** UTF-16 offset into the template where the problem lies. */
	readonly offset: number;

	/**
	 * @param offset - Where the problem lies.
	 * @param message - What is wrong there.
	 */
	constructor(offset: number, message: string) {
		super(`${message} (at offset ${offset})`);
		this.offset = offset;
	}
}
