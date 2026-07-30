/**
 * The failure value a purge reports. It keeps the selector that did not take
 * effect, because the useful log line after a failed purge is not "purge failed"
 * but which tags or prefix are still serving stale content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PurgeSelector } from "./types";

/**
 * Error describing a purge that did not happen, returned inside a `Failure` and
 * never thrown. A platform rejection is kept as the error's `cause`.
 */
export class PurgeError extends Error {
	/** What the call meant to invalidate, or `undefined` when nothing was selected. */
	readonly selector: PurgeSelector | undefined;

	/**
	 * Builds an error naming the selector that stayed stale.
	 *
	 * @param message - What went wrong, phrased for a log line.
	 * @param options.selector - The selector the failed call carried, when there was one.
	 * @param options.cause - The platform error, kept for diagnostics.
	 */
	constructor(message: string, options: { selector?: PurgeSelector; cause?: unknown } = {}) {
		super(message, { cause: options.cause });
		this.name = "PurgeError";
		this.selector = options.selector;
	}
}
