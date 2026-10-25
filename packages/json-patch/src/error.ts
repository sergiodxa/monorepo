/**
 * The one failure every JSON Patch call reports, tagged with why it failed and which
 * operation failed, so an HTTP handler can pick 400, 409 or 422 from `reason`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a patch failed: `"invalid-patch"` for a malformed document, `"unresolvable"` for a
 * path or `from` with nothing to act on, and `"test-failed"` for a `test` that did not hold.
 */
export type JsonPatchErrorReason = "invalid-patch" | "unresolvable" | "test-failed";

/** A patch that cannot be read or applied; applying it changed nothing. */
export class JsonPatchError extends Error {
	override name = "JsonPatchError";

	/** Maps onto RFC 5789's answers: 400 for `"invalid-patch"`, 422 for `"unresolvable"`, 409 for `"test-failed"`. */
	readonly reason: JsonPatchErrorReason;

	/** Position of the failing operation in the patch, or `null` when the document itself is at fault. */
	readonly index: number | null;

	/**
	 * @param reason - Why the patch failed.
	 * @param index - The failing operation's position, or `null`.
	 * @param message - A sentence naming the problem.
	 */
	constructor(reason: JsonPatchErrorReason, index: number | null, message: string) {
		super(index === null ? message : `Operation ${index}: ${message}`);
		this.reason = reason;
		this.index = index;
	}
}
