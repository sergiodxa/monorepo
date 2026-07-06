/**
 * Key-value store contract used across the r3-uptime app. It declares the minimal
 * KVStore interface for getting, putting (with optional TTL), deleting, and listing
 * entries. It exists to decouple app code from any concrete KV implementation so
 * adapters like the KV session storage can depend on an abstraction.
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
