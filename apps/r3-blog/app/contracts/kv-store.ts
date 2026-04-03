export interface KVStore {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string | ArrayBuffer | ReadableStream | ArrayBufferView,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
	list(): Promise<{ keys: Array<{ name: string }> }>;
}
