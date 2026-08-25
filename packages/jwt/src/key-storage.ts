/**
 * The storage contract `JWK.signingKeys` needs, and nothing more.
 *
 * Signing keys have to outlive the isolate that generated them and be readable by
 * every isolate that issues tokens, so they live in a bucket rather than in memory.
 * This declares only the three operations that requires — read one, write one, page
 * through them — so any object store can back it without this package taking on a
 * dependency on a particular storage client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Paging and filtering options for a {@link KeyStorage} listing. */
export interface KeyStorageListOptions {
	/** Opaque continuation token from a previous listing. */
	cursor?: string;
	/** Maximum number of entries to return in this page. */
	limit?: number;
	/** Only return entries whose key starts with this string. */
	prefix?: string;
}

/** One page of a {@link KeyStorage} listing. */
export interface KeyStorageListResult {
	/** Continuation token, absent once the listing is exhausted. */
	cursor?: string;
	/** The entries in this page, keys only. */
	files: { key: string }[];
}

/**
 * A key/value store of `File` objects, narrowed to what signing-key rotation uses.
 *
 * A key, once written, stays kept, so every token it signed stays
 * verifiable; methods may be sync or a promise, fitting tests and production.
 */
export interface KeyStorage {
	/**
	 * Reads the file stored under a key.
	 *
	 * @param key - The storage key to read.
	 * @returns The file, or `null` when nothing is stored under that key.
	 */
	get(key: string): File | null | Promise<File | null>;

	/**
	 * Pages through the stored keys.
	 *
	 * @param options - Prefix, page size, and continuation token.
	 * @returns One page of entries, plus a cursor when more remain.
	 */
	list(options?: KeyStorageListOptions): KeyStorageListResult | Promise<KeyStorageListResult>;

	/**
	 * Writes a file under a key, replacing anything already there.
	 *
	 * @param key - The storage key to write to.
	 * @param file - The file to store.
	 */
	set(key: string, file: File): void | Promise<void>;
}
