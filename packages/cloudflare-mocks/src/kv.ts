/**
 * In-memory `KVNamespace` binding with real Workers KV semantics: value encoding per
 * `type`, absolute/TTL expiration, metadata, and cursor-paginated prefix listing. It
 * exists so a test can assert on stored data instead of mocking the module that reads it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Value shapes Workers KV can decode a stored value into. */
type KVValueType = "text" | "json" | "arrayBuffer" | "stream";

/** Second argument accepted by `get`/`getWithMetadata`: a bare type or an options bag. */
type KVReadArgument = KVValueType | Partial<KVNamespaceGetOptions<KVValueType | undefined>>;

/** Workers KV refuses any `expirationTtl` below this many seconds. */
const MINIMUM_EXPIRATION_TTL = 60;

/** Keys returned by `list` when no `limit` is given. */
const DEFAULT_LIST_LIMIT = 1000;

/** Upper bound Workers KV enforces on `list({ limit })`. */
const MAXIMUM_LIST_LIMIT = 1000;

/** Keys accepted by a single bulk `get`/`getWithMetadata` call. */
const MAXIMUM_BULK_KEYS = 100;

/** Byte budget for a key name. */
const MAXIMUM_KEY_BYTES = 512;

/** Byte budget for a key's serialized metadata. */
const MAXIMUM_METADATA_BYTES = 1024;

/** Byte budget for a stored value (25 MiB). */
const MAXIMUM_VALUE_BYTES = 25 * 1024 * 1024;

/** Options for {@link createKVNamespace}. */
export interface KVNamespaceMockOptions {
	/**
	 * Clock used to evaluate expiration, in milliseconds since the epoch. Because the
	 * mock enforces the real 60 second `expirationTtl` floor, an injected clock is the
	 * only way to observe expiry without waiting a real minute.
	 */
	now?: () => number;
}

/** A value stored under a key, with its resolved absolute expiration. */
interface KVStoredEntry {
	/** Raw bytes, always an owned copy so callers cannot mutate stored data. */
	value: ArrayBuffer;
	/** Absolute expiration as a Unix timestamp in seconds; absent means never. */
	expiration?: number;
	/** Metadata supplied on `put`, or `null` when none was given. */
	metadata: unknown;
}

/**
 * Creates an in-memory Workers KV namespace whose `get`, `put`, `delete`, `list`, and
 * `getWithMetadata` follow the platform's observable behavior, including expiration,
 * metadata round-tripping, and prefix/cursor listing.
 *
 * Every call builds an isolated namespace, so tests never share state and no cleanup
 * step can be forgotten.
 * @param options Optional clock override used for expiration.
 * @returns A `KVNamespace` binding backed by an in-memory map.
 * @example let kv = createKVNamespace(); await kv.put("a", "1");
 * @example let kv = createKVNamespace({ now: () => clock });
 */
export function createKVNamespace(options?: KVNamespaceMockOptions): KVNamespace {
	let entries = new Map<string, KVStoredEntry>();
	let now = options?.now ?? Date.now;

	/** Current time in whole seconds, the unit KV expresses expiration in. */
	function currentSeconds(): number {
		return Math.floor(now() / 1000);
	}

	/**
	 * Reads a live entry, dropping it first when its expiration has passed so an
	 * expired key is indistinguishable from a key that was never written.
	 */
	function readEntry(key: string): KVStoredEntry | null {
		let entry = entries.get(key);
		if (!entry) return null;

		if (entry.expiration !== undefined && entry.expiration <= currentSeconds()) {
			entries.delete(key);
			return null;
		}

		return entry;
	}

	/**
	 * Resolves the `type` a read requested, defaulting to `"text"` exactly as KV does
	 * for a bare `get(key)` or an options bag without a `type`.
	 */
	function resolveType(argument?: KVReadArgument): KVValueType {
		if (typeof argument === "string") return argument;
		return argument?.type ?? "text";
	}

	/** Decodes stored bytes into the shape the caller asked for. */
	function decode(entry: KVStoredEntry, type: KVValueType): unknown {
		if (type === "arrayBuffer") return entry.value.slice(0);

		if (type === "stream") {
			let bytes = new Uint8Array(entry.value.slice(0));
			return new ReadableStream({
				start(controller) {
					controller.enqueue(bytes);
					controller.close();
				},
			});
		}

		let text = new TextDecoder().decode(entry.value);
		if (type === "json") return JSON.parse(text);
		return text;
	}

	/**
	 * Rejects the bulk read shapes KV itself rejects: more than 100 keys per call, and
	 * `arrayBuffer`/`stream` types, which the bulk endpoint does not serve.
	 */
	function assertBulkRead(keys: string[], type: KVValueType): void {
		if (keys.length > MAXIMUM_BULK_KEYS) {
			throw new Error(
				`KV GET failed: 400 More than ${String(MAXIMUM_BULK_KEYS)} keys requested in a bulk get`,
			);
		}

		if (type === "arrayBuffer" || type === "stream") {
			throw new Error(`KV GET failed: 400 Type ${type} is not supported for bulk gets`);
		}
	}

	/**
	 * Reads many keys at once. Missing and expired keys are present in the map with a
	 * `null` value, matching the bulk endpoint rather than omitting them.
	 */
	function getMany(keys: string[], type: KVValueType): Map<string, unknown> {
		assertBulkRead(keys, type);

		let results = new Map<string, unknown>();

		for (let key of keys) {
			let entry = readEntry(key);
			results.set(key, entry ? decode(entry, type) : null);
		}

		return results;
	}

	/** Reads many keys at once, pairing each value with its metadata. */
	function getManyWithMetadata(keys: string[], type: KVValueType): Map<string, unknown> {
		assertBulkRead(keys, type);

		let results = new Map<string, unknown>();

		for (let key of keys) {
			let entry = readEntry(key);
			results.set(key, {
				value: entry ? decode(entry, type) : null,
				metadata: entry ? (entry.metadata ?? null) : null,
				cacheStatus: null,
			});
		}

		return results;
	}

	/**
	 * Reads a key, or every key when given an array.
	 * @param key Key name, or up to 100 key names for a bulk read.
	 * @param typeOrOptions Value type (`"text"` by default) or a KV options bag.
	 * @returns The decoded value, `null` when absent or expired, or a `Map` for a bulk read.
	 */
	function get(
		key: string,
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<string | null>;
	function get(key: string, type: "text"): Promise<string | null>;
	function get<ExpectedValue = unknown>(key: string, type: "json"): Promise<ExpectedValue | null>;
	function get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
	function get(key: string, type: "stream"): Promise<ReadableStream | null>;
	function get(key: string, options?: KVNamespaceGetOptions<"text">): Promise<string | null>;
	function get<ExpectedValue = unknown>(
		key: string,
		options?: KVNamespaceGetOptions<"json">,
	): Promise<ExpectedValue | null>;
	function get(
		key: string,
		options?: KVNamespaceGetOptions<"arrayBuffer">,
	): Promise<ArrayBuffer | null>;
	function get(
		key: string,
		options?: KVNamespaceGetOptions<"stream">,
	): Promise<ReadableStream | null>;
	function get(key: string[], type: "text"): Promise<Map<string, string | null>>;
	function get<ExpectedValue = unknown>(
		key: string[],
		type: "json",
	): Promise<Map<string, ExpectedValue | null>>;
	function get(
		key: string[],
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<Map<string, string | null>>;
	function get(
		key: string[],
		options?: KVNamespaceGetOptions<"text">,
	): Promise<Map<string, string | null>>;
	function get<ExpectedValue = unknown>(
		key: string[],
		options?: KVNamespaceGetOptions<"json">,
	): Promise<Map<string, ExpectedValue | null>>;
	// `async` so a rejected input surfaces as a rejected promise, the way a real KV read
	// reports a bad request rather than throwing synchronously.
	async function get(key: string | string[], typeOrOptions?: KVReadArgument): Promise<unknown> {
		let type = resolveType(typeOrOptions);

		if (Array.isArray(key)) return getMany(key, type);

		let entry = readEntry(key);
		return entry ? decode(entry, type) : null;
	}

	/**
	 * Reads a key together with the metadata stored alongside it. Unlike `get`, this
	 * always resolves to a result object, with `value: null` for a missing key.
	 * @param key Key name, or up to 100 key names for a bulk read.
	 * @param typeOrOptions Value type (`"text"` by default) or a KV options bag.
	 * @returns The value/metadata pair, or a `Map` of them for a bulk read.
	 */
	function getWithMetadata<Metadata = unknown>(
		key: string,
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
	function getWithMetadata<Metadata = unknown>(
		key: string,
		type: "text",
	): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
	function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
		key: string,
		type: "json",
	): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>;
	function getWithMetadata<Metadata = unknown>(
		key: string,
		type: "arrayBuffer",
	): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>;
	function getWithMetadata<Metadata = unknown>(
		key: string,
		type: "stream",
	): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>;
	function getWithMetadata<Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"text">,
	): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>>;
	function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"json">,
	): Promise<KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>;
	function getWithMetadata<Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"arrayBuffer">,
	): Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, Metadata>>;
	function getWithMetadata<Metadata = unknown>(
		key: string,
		options: KVNamespaceGetOptions<"stream">,
	): Promise<KVNamespaceGetWithMetadataResult<ReadableStream, Metadata>>;
	function getWithMetadata<Metadata = unknown>(
		key: string[],
		type: "text",
	): Promise<Map<string, KVNamespaceGetWithMetadataResult<string, Metadata>>>;
	function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
		key: string[],
		type: "json",
	): Promise<Map<string, KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>>;
	function getWithMetadata<Metadata = unknown>(
		key: string[],
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<Map<string, KVNamespaceGetWithMetadataResult<string, Metadata>>>;
	function getWithMetadata<Metadata = unknown>(
		key: string[],
		options?: KVNamespaceGetOptions<"text">,
	): Promise<Map<string, KVNamespaceGetWithMetadataResult<string, Metadata>>>;
	function getWithMetadata<ExpectedValue = unknown, Metadata = unknown>(
		key: string[],
		options?: KVNamespaceGetOptions<"json">,
	): Promise<Map<string, KVNamespaceGetWithMetadataResult<ExpectedValue, Metadata>>>;
	async function getWithMetadata(
		key: string | string[],
		typeOrOptions?: KVReadArgument,
	): Promise<unknown> {
		let type = resolveType(typeOrOptions);

		if (Array.isArray(key)) return getManyWithMetadata(key, type);

		let entry = readEntry(key);

		return {
			value: entry ? decode(entry, type) : null,
			metadata: entry ? (entry.metadata ?? null) : null,
			cacheStatus: null,
		};
	}

	/**
	 * Writes a value, replacing any existing one. Rejects the inputs Workers KV rejects:
	 * an oversized key, value, or metadata blob, and an `expirationTtl` under 60 seconds.
	 * @param key Key name.
	 * @param value Value to store; streams are drained before the write resolves.
	 * @param putOptions Absolute `expiration` (Unix seconds), relative `expirationTtl`
	 * (seconds), and arbitrary JSON `metadata`.
	 */
	async function put(
		key: string,
		value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
		putOptions?: KVNamespacePutOptions,
	): Promise<void> {
		assertKeyName(key);

		let bytes = await toArrayBuffer(value);

		if (bytes.byteLength > MAXIMUM_VALUE_BYTES) {
			throw new Error(
				`KV PUT failed: 413 Value length of ${String(bytes.byteLength)} exceeds limit of ${String(MAXIMUM_VALUE_BYTES)}`,
			);
		}

		assertMetadataSize(putOptions?.metadata);

		entries.set(key, {
			value: bytes,
			expiration: resolveExpiration(putOptions, currentSeconds()),
			metadata: putOptions?.metadata ?? null,
		});
	}

	/**
	 * Removes a key. Deleting a key that is absent or already expired is a no-op, as it
	 * is on the platform.
	 * @param key Key name.
	 */
	async function remove(key: string): Promise<void> {
		entries.delete(key);
	}

	/**
	 * Lists key names in lexicographic order, filtered by `prefix` and paginated by
	 * `limit`/`cursor`. Expired keys are skipped, and each entry carries its
	 * `expiration` and `metadata` when present.
	 * @param listOptions `prefix`, `limit` (1000 max and by default), and an opaque
	 * `cursor` from a previous incomplete page.
	 * @returns A page of keys plus a cursor when more keys remain.
	 */
	async function list<Metadata = unknown>(
		listOptions?: KVNamespaceListOptions,
	): Promise<KVNamespaceListResult<Metadata, string>> {
		let limit = normalizeListLimit(listOptions?.limit);
		let prefix = listOptions?.prefix ?? "";
		let after = decodeCursor(listOptions?.cursor);
		let seconds = currentSeconds();

		let names = [...entries.keys()].sort();
		let keys: KVNamespaceListKey<Metadata, string>[] = [];
		let complete = true;

		for (let name of names) {
			if (!name.startsWith(prefix)) continue;
			if (after !== null && name <= after) continue;

			let entry = entries.get(name);
			if (!entry) continue;
			if (entry.expiration !== undefined && entry.expiration <= seconds) continue;

			if (keys.length === limit) {
				complete = false;
				break;
			}

			let key: KVNamespaceListKey<Metadata, string> = { name };
			if (entry.expiration !== undefined) key.expiration = entry.expiration;
			if (entry.metadata !== null && entry.metadata !== undefined) {
				key.metadata = entry.metadata as Metadata;
			}

			keys.push(key);
		}

		if (complete) return { list_complete: true, keys, cacheStatus: null };

		let last = keys[keys.length - 1];

		return {
			list_complete: false,
			keys,
			cursor: encodeCursor(last ? last.name : ""),
			cacheStatus: null,
		};
	}

	return { get, getWithMetadata, put, delete: remove, list };
}

/** Rejects key names KV rejects: empty, `.`/`..`, or longer than 512 bytes. */
function assertKeyName(key: string): void {
	if (key === "" || key === "." || key === "..") {
		throw new Error(`KV PUT failed: 400 Invalid key name "${key}"`);
	}

	let length = new TextEncoder().encode(key).byteLength;

	if (length > MAXIMUM_KEY_BYTES) {
		throw new Error(
			`KV PUT failed: 414 Key length of ${String(length)} exceeds limit of ${String(MAXIMUM_KEY_BYTES)}`,
		);
	}
}

/** Rejects metadata whose JSON encoding exceeds the platform's 1 KiB budget. */
function assertMetadataSize(metadata: unknown): void {
	if (metadata === null || metadata === undefined) return;

	let length = new TextEncoder().encode(JSON.stringify(metadata)).byteLength;

	if (length > MAXIMUM_METADATA_BYTES) {
		throw new Error(
			`KV PUT failed: 413 Metadata length of ${String(length)} exceeds limit of ${String(MAXIMUM_METADATA_BYTES)}`,
		);
	}
}

/**
 * Resolves `expiration`/`expirationTtl` to one absolute Unix timestamp in seconds.
 *
 * `expirationTtl` wins when both are given, matching KV. A TTL under 60 seconds is
 * rejected, which is why {@link KVNamespaceMockOptions.now} exists.
 */
function resolveExpiration(
	options: KVNamespacePutOptions | undefined,
	seconds: number,
): number | undefined {
	if (options?.expirationTtl !== undefined) {
		if (options.expirationTtl < MINIMUM_EXPIRATION_TTL) {
			throw new Error(
				`KV PUT failed: 400 Invalid expiration_ttl of ${String(options.expirationTtl)}. Expiration TTL must be at least ${String(MINIMUM_EXPIRATION_TTL)}.`,
			);
		}

		return seconds + Math.floor(options.expirationTtl);
	}

	if (options?.expiration !== undefined) {
		if (options.expiration < seconds + MINIMUM_EXPIRATION_TTL) {
			throw new Error(
				`KV PUT failed: 400 Invalid expiration of ${String(options.expiration)}. Expiration times must be at least ${String(MINIMUM_EXPIRATION_TTL)} seconds in the future.`,
			);
		}

		return Math.floor(options.expiration);
	}

	return undefined;
}

/** Clamps a requested `list` limit into the 1..1000 range KV accepts. */
function normalizeListLimit(limit: number | undefined): number {
	if (limit === undefined) return DEFAULT_LIST_LIMIT;
	if (limit < 1) throw new Error("KV LIST failed: 400 Invalid limit, must be at least 1");
	return Math.min(Math.floor(limit), MAXIMUM_LIST_LIMIT);
}

/** Encodes the last key of a page into the opaque cursor KV hands back. */
function encodeCursor(key: string): string {
	return btoa(key);
}

/** Decodes a cursor into the key a page must resume after, or `null` for a first page. */
function decodeCursor(cursor: string | null | undefined): string | null {
	if (cursor === null || cursor === undefined || cursor === "") return null;

	try {
		return atob(cursor);
	} catch {
		throw new Error("KV LIST failed: 400 Invalid cursor");
	}
}

/** Copies any accepted `put` value into an owned `ArrayBuffer`. */
async function toArrayBuffer(
	value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
): Promise<ArrayBuffer> {
	if (typeof value === "string") {
		let encoded = new TextEncoder().encode(value);
		return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
	}

	if (value instanceof ArrayBuffer) return value.slice(0);

	if (ArrayBuffer.isView(value)) {
		let bytes = new Uint8Array(value.byteLength);
		bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
		return bytes.buffer;
	}

	return new Response(value).arrayBuffer();
}
