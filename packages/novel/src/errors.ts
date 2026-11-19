/**
 * The one error the engine reports, with a code naming what went wrong. It travels on `error`
 * frames and in failed `Result`s, so the play never throws past its caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * What went wrong, so a caller can react to one case: a stale, malformed or unavailable reply,
 * refused interaction output, saved state or migration, a scene with no module or a module that
 * failed to load, directives that ran on without a stop, a story problem the play continued past
 * (a menu with no option, an undeclared asset, a message a catalog lacks), or a failed listener.
 */
export type NovelErrorCode =
	| "stale-reply"
	| "invalid-reply"
	| "unavailable-option"
	| "invalid-output"
	| "invalid-state"
	| "migration-failed"
	| "unmapped-scene"
	| "load-failed"
	| "endless-loop"
	| "dead-end-menu"
	| "missing-asset"
	| "missing-message"
	| "listener-failed";

/** What an error is about, beyond its message, for a tool that groups or links errors. */
export interface NovelErrorOptions extends ErrorOptions {
	/** The scene, message key, asset id or event the error names. */
	subject?: string;
	/** The locale whose catalog lacks a message. */
	locale?: string;
}

/** An error from a novel or a play, named by its code. */
export class NovelError extends Error {
	override name = "NovelError";

	/** What went wrong, for code that reacts to one case. */
	readonly code: NovelErrorCode;

	/** The scene, message key, asset id or event the error names, when it names one. */
	readonly subject?: string;

	/** The locale a `missing-message` error was found in. */
	readonly locale?: string;

	/**
	 * @param code - What went wrong.
	 * @param message - A description naming the scene, key or option involved.
	 * @param options - The underlying cause, and the subject and locale it is about.
	 */
	constructor(code: NovelErrorCode, message: string, options: NovelErrorOptions = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.code = code;
		if (options.subject !== undefined) this.subject = options.subject;
		if (options.locale !== undefined) this.locale = options.locale;
	}
}
