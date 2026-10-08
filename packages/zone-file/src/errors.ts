/**
 * The two failures this package returns: RDATA that does not fit its type, and a zone file
 * too large to read at all. Everything else wrong with a file is a line-level rejection
 * beside the records that did parse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** RDATA that does not parse for its type. */
export class RecordDataError extends Error {
	override name = "RecordDataError";
}

/** A zone file that `parse` refuses whole; its `code` names why. */
export class ZoneFileError extends Error {
	override name = "ZoneFileError";

	/** The input, with its includes, passed `maxBytes`. */
	readonly code = "too-large";

	/** UTF-8 bytes read when the limit was passed, included files counted. */
	readonly bytes: number;

	/**
	 * @param bytes - The bytes read so far.
	 * @param maxBytes - The limit they passed.
	 */
	constructor(bytes: number, maxBytes: number) {
		super(`The zone file is ${bytes} bytes, over the ${maxBytes} byte limit`);
		this.bytes = bytes;
	}
}
