/**
 * Defines the `KVStore` interface: an app-level abstraction over a key-value
 * store with get, put, delete, and list operations. Decouples repositories and
 * services from the concrete Cloudflare KV binding so they can be tested/mocked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Contract for reading, writing, and listing values in a key-value store.
 */
export interface KVStore {
	/**
	 * Reads a value by key.
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
	 * Lists stored keys.
	 * @returns Object containing key names available in the store.
	 */
	list(): Promise<{ keys: Array<{ name: string }> }>;
}
