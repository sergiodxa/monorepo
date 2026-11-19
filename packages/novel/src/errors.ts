/**
 * The one error the engine reports, with a code naming what went wrong. It travels on `error`
 * frames and in failed `Result`s, so the play never throws past its caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * What went wrong, so a caller can react to one case: a stale, malformed or unavailable reply,
 * refused interaction output or saved state, a scene with no module or a module that failed to
 * load, or directives that ran on without a stop.
 */
export type NovelErrorCode =
	| "stale-reply"
	| "invalid-reply"
	| "unavailable-option"
	| "invalid-output"
	| "invalid-state"
	| "unmapped-scene"
	| "load-failed"
	| "endless-loop";

/** An error from a novel or a play, named by its code. */
export class NovelError extends Error {
	override name = "NovelError";

	/** What went wrong, for code that reacts to one case. */
	readonly code: NovelErrorCode;

	/**
	 * @param code - What went wrong.
	 * @param message - A description naming the scene, key or option involved.
	 * @param options - The underlying cause, when there is one.
	 */
	constructor(code: NovelErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
	}
}
