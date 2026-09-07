/**
 * The single failure type every cache call reports: one normalized code, the
 * key it happened on, and the original error as `cause`. It is the error inside
 * every `Result` the contract returns, so no cache path throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Normalized reason a cache call failed. A caller branches on this; the original
 * error travels alongside as `cause`.
 */
export type CacheErrorCode =
	/** The store could not be reached, or refused the operation. */
	| "unavailable"
	/** JSON could not write the value handed over, or read the entry stored. */
	| "invalid_value"
	/** The loader a `fetch` was given failed, so there is no value to answer with. */
	| "load_failed";

/** What a cache states about a failure when it constructs the error. */
export interface CacheErrorOptions extends ErrorOptions {
	code: CacheErrorCode;
	/** The entry the call was made on. */
	key: string;
}

/**
 * Failure carried by every cache `Result`.
 *
 * `unavailable` is the one a caller can ignore: the value is simply not cached,
 * and computing it is the same recovery a miss asks for. `load_failed` is the
 * one that matters, because it means the value could not be produced at all.
 *
 * @example
 * failure(new CacheError("KV refused the put", { code: "unavailable", key }));
 */
export class CacheError extends Error {
	override name = "CacheError";

	readonly code: CacheErrorCode;

	/** The entry the failing call was made on. */
	readonly key: string;

	/**
	 * @param message What went wrong, for a log or a rethrow.
	 * @param options The code, the key, and the original error as `cause`.
	 */
	constructor(message: string, { code, key, ...options }: CacheErrorOptions) {
		super(message, options);
		this.code = code;
		this.key = key;
	}
}
