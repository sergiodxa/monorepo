/**
 * Where definitions come from: one read that answers with the whole set, the
 * shape it answers in, and the single failure type it reports. Implemented by
 * every store, and the only thing the engine knows about storage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MaybePromise } from "@sdxc/flags";
import type { Result } from "@sdxc/result";

/**
 * A definition set as a store holds it. Values arrive as `unknown` because
 * producing the JSON is the store's job and deciding whether that JSON is a
 * valid flag is the engine's, in one place against one schema.
 */
export interface StoredFlagSet {
	flags: Record<string, unknown>;
	segments?: Record<string, unknown>;
	/** What the store calls this revision, for a caller that caches snapshots. */
	version?: string;
}

/**
 * A source of flag definitions. The engine asks for everything at once because
 * segments are shared across flags and a store is read once per snapshot, so
 * the query that matters is the one that fills it.
 *
 * `read` may answer synchronously, so a store already holding its set in memory
 * costs no promise.
 */
export interface FlagStore {
	read(): MaybePromise<Result<StoredFlagSet, FlagStoreError>>;
}

/**
 * Normalized reason a store could not hand over its set. A caller branches on
 * this; whatever the underlying storage threw travels alongside as `cause`.
 */
export type FlagStoreErrorCode =
	/** The storage could not be reached, or refused the read. */
	| "unavailable"
	/** The storage answered, and what it holds is not JSON. */
	| "invalid_value";

/** What a store states about a failure when it constructs the error. */
export interface FlagStoreErrorOptions extends ErrorOptions {
	code: FlagStoreErrorCode;
	/** Where the store looked, such as the key a value was read from. */
	location?: string;
}

/**
 * Failure carried by every `FlagStore` result.
 *
 * An empty store is a success holding an empty set, so reaching this type means
 * the definitions exist somewhere and could not be obtained — a configuration
 * failure a caller reports, rather than a flag falling back.
 *
 * @example
 * failure(new FlagStoreError("KV refused the get", { code: "unavailable" }));
 */
export class FlagStoreError extends Error {
	override name = "FlagStoreError";

	readonly code: FlagStoreErrorCode;

	/** Where the store looked, such as the key a value was read from. */
	readonly location?: string;

	/**
	 * @param message What went wrong, for a log or a rethrow.
	 * @param options The code, where the store looked, and the original error as `cause`.
	 */
	constructor(message: string, { code, location, ...options }: FlagStoreErrorOptions) {
		super(message, options);
		this.code = code;
		this.location = location;
	}
}
