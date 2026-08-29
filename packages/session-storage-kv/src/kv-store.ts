/**
 * Key-value store contract this package's session storage depends on. Declares
 * the minimal get/put/delete/list surface a KV-like binding must expose, so the
 * session storage adapter can run against Cloudflare Workers KV, an in-memory
 * fake for tests, or any other backend that implements it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Contract for reading, writing, and listing values in a key-value store.
 */
export interface KVStore {
	/**
	 * @returns Stored value or `null` when the key does not exist.
	 */
	get(key: string): Promise<string | null>;

	/**
	 * Stores or replaces a value for a key.
	 * @param options.expirationTtl Time to live in seconds.
	 */
	put(
		key: string,
		value: string | ArrayBuffer | ReadableStream | ArrayBufferView,
		options?: { expirationTtl?: number },
	): Promise<void>;

	/**
	 * Removes a key and its value.
	 */
	delete(key: string): Promise<void>;

	/**
	 * @returns Object containing key names available in the store.
	 */
	list(): Promise<{ keys: Array<{ name: string }> }>;
}
