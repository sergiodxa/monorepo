/**
 * In-memory `R2Bucket` binding: objects with HTTP and custom metadata, real MD5 etags,
 * conditional reads and writes, range reads, delimiter-grouped listing, and multipart
 * uploads, so object-storage code can be tested against stored bytes rather than a stub.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createHash } from "node:crypto";

/** Objects returned by `list` when no `limit` is given, and the ceiling R2 enforces. */
const DEFAULT_LIST_LIMIT = 1000;

/** Storage class assigned to objects that do not ask for one. */
const DEFAULT_STORAGE_CLASS = "Standard";

/** Digest algorithms R2 can verify on upload. */
const CHECKSUM_ALGORITHMS = ["md5", "sha1", "sha256", "sha384", "sha512"] as const;

/** Value shapes accepted by `put` and `uploadPart`. */
type R2Value = ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob;

/** A stored object: its bytes plus everything R2 reports about it. */
interface R2StoredObject {
	/** Object key. */
	key: string;
	/** Opaque version assigned on write. */
	version: string;
	/** Object bytes. */
	bytes: ArrayBuffer;
	/** MD5 hex digest, which is also the object's etag. */
	etag: string;
	/** Write time. */
	uploaded: Date;
	/** HTTP metadata replayed by `writeHttpMetadata`. */
	httpMetadata: R2HTTPMetadata;
	/** Arbitrary string metadata stored with the object. */
	customMetadata: Record<string, string>;
	/** Storage class the object was written with. */
	storageClass: string;
	/** Digests computed at write time. */
	checksums: R2StringChecksums;
}

/** An in-progress multipart upload. */
interface R2StoredUpload {
	/** Key the completed object will be written to. */
	key: string;
	/** Parts uploaded so far, keyed by part number. */
	parts: Map<number, ArrayBuffer>;
	/** Options captured when the upload was created. */
	options?: R2MultipartOptions;
}

/** An `R2Bucket` binding backed by an in-memory object store. */
export interface R2BucketMock extends R2Bucket {
	/** Keys currently stored, in lexicographic order. */
	readonly keys: string[];

	/**
	 * Discards every object and every in-flight multipart upload, as if the bucket were
	 * new.
	 *
	 * A binding installed once at module scope outlives the test that used it, so this is
	 * how a `beforeEach` gets an empty bucket without re-creating the `env` the code under
	 * test already captured.
	 */
	reset(): void;
}

/**
 * Creates an in-memory R2 bucket.
 *
 * Writes compute a real MD5 etag and verify any checksum the caller supplies, so a
 * corrupted upload fails here the way it fails on the platform. Reads honour `range` and
 * `onlyIf`, and `list` implements prefix, delimiter, cursor, and `include` semantics.
 * @returns An `R2Bucket` binding storing objects in memory.
 * @example let bucket = createR2Bucket(); await bucket.put("a.txt", "hello");
 */
export function createR2Bucket(): R2BucketMock {
	let objects = new Map<string, R2StoredObject>();
	let uploads = new Map<string, R2StoredUpload>();
	let version = 0;

	/**
	 * Reads an object's metadata without its body.
	 * @param key Object key.
	 * @returns The object, or `null` when the key is absent.
	 */
	function head(key: string): Promise<R2Object | null> {
		let stored = objects.get(key);
		return Promise.resolve(stored ? toR2Object(stored) : null);
	}

	/**
	 * Reads an object, optionally a byte range of it, and optionally only if a condition
	 * holds. A failed `onlyIf` resolves to the object without a body, as R2 does, so the
	 * caller can distinguish "condition failed" from "missing".
	 * @param key Object key.
	 * @param options `range`, `onlyIf`, and other read options.
	 * @returns The object with a body, the object alone, or `null` when absent.
	 */
	function get(
		key: string,
		options: R2GetOptions & { onlyIf: R2Conditional | Headers },
	): Promise<R2ObjectBody | R2Object | null>;
	function get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
	function get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | R2Object | null> {
		let stored = objects.get(key);
		if (!stored) return Promise.resolve(null);

		if (options?.onlyIf && !matchesConditional(stored, options.onlyIf)) {
			return Promise.resolve(toR2Object(stored));
		}

		let range = options?.range ? resolveRange(options.range, stored.bytes.byteLength) : undefined;

		return Promise.resolve(toR2ObjectBody(stored, range));
	}

	/**
	 * Writes an object, replacing any existing one under the same key.
	 * @param key Object key.
	 * @param value Bytes to store; `null` stores an empty object.
	 * @param options HTTP/custom metadata, checksums to verify, storage class, `onlyIf`.
	 * @returns The stored object, or `null` when `onlyIf` prevented the write.
	 */
	function put(
		key: string,
		value: R2Value,
		options?: R2PutOptions & { onlyIf: R2Conditional | Headers },
	): Promise<R2Object | null>;
	function put(key: string, value: R2Value, options?: R2PutOptions): Promise<R2Object>;
	async function put(
		key: string,
		value: R2Value,
		options?: R2PutOptions,
	): Promise<R2Object | null> {
		let existing = objects.get(key);

		if (options?.onlyIf) {
			let satisfied = existing
				? matchesConditional(existing, options.onlyIf)
				: isAbsentAllowed(options.onlyIf);

			if (!satisfied) return null;
		}

		let bytes = await toArrayBuffer(value);
		let checksums = computeChecksums(bytes);

		verifyChecksums(options, checksums);

		version += 1;

		let stored: R2StoredObject = {
			key,
			version: `mock-version-${String(version)}`,
			bytes,
			etag: checksums.md5 ?? "",
			uploaded: new Date(),
			httpMetadata: toHttpMetadata(options?.httpMetadata),
			customMetadata: { ...options?.customMetadata },
			storageClass: options?.storageClass ?? DEFAULT_STORAGE_CLASS,
			checksums,
		};

		objects.set(key, stored);

		return toR2Object(stored);
	}

	/**
	 * Removes one or many objects. Deleting an absent key is a no-op, as on the platform.
	 * @param keys Key or keys to remove.
	 */
	function remove(keys: string | string[]): Promise<void> {
		for (let key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
		return Promise.resolve();
	}

	/**
	 * Lists objects in lexicographic key order.
	 *
	 * With a `delimiter`, keys that contain it after the prefix collapse into
	 * `delimitedPrefixes` instead of appearing as objects, which is how R2 emulates
	 * directories. Metadata is omitted unless asked for through `include`.
	 * @param options `prefix`, `delimiter`, `limit`, `cursor`, `startAfter`, `include`.
	 * @returns A page of objects and collapsed prefixes, with a cursor when truncated.
	 */
	function list(options?: R2ListOptions): Promise<R2Objects> {
		let prefix = options?.prefix ?? "";
		let delimiter = options?.delimiter;
		let limit = Math.min(options?.limit ?? DEFAULT_LIST_LIMIT, DEFAULT_LIST_LIMIT);
		let after = decodeCursor(options?.cursor) ?? options?.startAfter;
		let include = options?.include ?? [];

		let names = [...objects.keys()].sort();
		let listed: R2Object[] = [];
		let prefixes = new Set<string>();
		let truncated = false;
		let last = "";

		for (let name of names) {
			if (!name.startsWith(prefix)) continue;
			if (after !== undefined && name <= after) continue;

			let group = delimiter ? findDelimitedPrefix(name, prefix, delimiter) : null;

			if (group !== null) {
				if (prefixes.has(group)) continue;

				if (listed.length + prefixes.size === limit) {
					truncated = true;
					break;
				}

				prefixes.add(group);
				last = name;
				continue;
			}

			if (listed.length + prefixes.size === limit) {
				truncated = true;
				break;
			}

			let stored = objects.get(name);
			if (!stored) continue;

			listed.push(toR2Object(stored, undefined, include));
			last = name;
		}

		let delimitedPrefixes = [...prefixes].sort();

		if (!truncated)
			return Promise.resolve({ objects: listed, delimitedPrefixes, truncated: false });

		return Promise.resolve({
			objects: listed,
			delimitedPrefixes,
			truncated: true,
			cursor: encodeCursor(last),
		});
	}

	/**
	 * Starts a multipart upload. Parts are buffered until `complete`, so nothing is
	 * readable under the key until then.
	 * @param key Key the completed object will be written to.
	 * @param options Metadata applied to the completed object.
	 * @returns A handle for uploading parts.
	 */
	function createMultipartUpload(
		key: string,
		options?: R2MultipartOptions,
	): Promise<R2MultipartUpload> {
		let uploadId = crypto.randomUUID();
		uploads.set(uploadId, { key, parts: new Map(), options });

		return Promise.resolve(createUploadHandle(key, uploadId));
	}

	/**
	 * Reattaches to an in-progress multipart upload.
	 * @param key Key the upload targets.
	 * @param uploadId Identifier from `createMultipartUpload`.
	 * @returns A handle for uploading further parts or completing the upload.
	 */
	function resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
		return createUploadHandle(key, uploadId);
	}

	/** Builds the upload handle both `createMultipartUpload` and `resume` hand back. */
	function createUploadHandle(key: string, uploadId: string): R2MultipartUpload {
		/** Reads the tracked upload, failing when it was aborted or completed. */
		function readUpload(): R2StoredUpload {
			let upload = uploads.get(uploadId);
			if (!upload) throw new Error(`R2: multipart upload ${uploadId} does not exist`);
			return upload;
		}

		return {
			key,
			uploadId,

			/**
			 * Buffers one part.
			 * @param partNumber 1-based part number; re-uploading a number replaces it.
			 * @param value Part bytes.
			 * @returns The part number and the part's etag.
			 */
			async uploadPart(partNumber: number, value: R2Value): Promise<R2UploadedPart> {
				let upload = readUpload();
				let bytes = await toArrayBuffer(value);
				upload.parts.set(partNumber, bytes);

				return { partNumber, etag: digest("md5", bytes) };
			},

			/** Discards the upload and every buffered part. */
			abort(): Promise<void> {
				uploads.delete(uploadId);
				return Promise.resolve();
			},

			/**
			 * Concatenates the listed parts and writes the object.
			 * @param uploadedParts Parts to assemble, which must be in ascending order.
			 * @returns The completed object.
			 */
			async complete(uploadedParts: R2UploadedPart[]): Promise<R2Object> {
				let upload = readUpload();
				let ordered = [...uploadedParts];

				for (let index = 1; index < ordered.length; index += 1) {
					let previous = ordered[index - 1] as R2UploadedPart;
					let current = ordered[index] as R2UploadedPart;

					if (current.partNumber <= previous.partNumber) {
						throw new Error("R2: multipart parts must be listed in ascending part-number order");
					}
				}

				let chunks = ordered.map((part) => {
					let bytes = upload.parts.get(part.partNumber);
					if (!bytes) throw new Error(`R2: part ${String(part.partNumber)} was never uploaded`);
					return bytes;
				});

				uploads.delete(uploadId);

				return (await put(upload.key, concatenate(chunks), {
					...upload.options,
				})) as R2Object;
			},
		};
	}

	return {
		get keys(): string[] {
			return [...objects.keys()].sort();
		},

		reset(): void {
			objects.clear();
			uploads.clear();
		},

		head,
		get,
		put,
		delete: remove,
		list,
		createMultipartUpload,
		resumeMultipartUpload,
	};
}

/**
 * Builds the metadata-only `R2Object` view of a stored object.
 *
 * The return type is inferred rather than annotated as `R2Object` so
 * {@link toR2ObjectBody} can spread it and keep `writeHttpMetadata`; every caller still
 * checks the shape through its own `R2Object` return type.
 */
function toR2Object(
	stored: R2StoredObject,
	range?: { offset: number; length: number },
	include?: ("httpMetadata" | "customMetadata")[],
) {
	let withHttp = include === undefined || include.includes("httpMetadata");
	let withCustom = include === undefined || include.includes("customMetadata");

	return {
		key: stored.key,
		version: stored.version,
		size: stored.bytes.byteLength,
		etag: stored.etag,
		httpEtag: `"${stored.etag}"`,
		checksums: toR2Checksums(stored.checksums),
		uploaded: stored.uploaded,
		httpMetadata: withHttp ? { ...stored.httpMetadata } : undefined,
		customMetadata: withCustom ? { ...stored.customMetadata } : undefined,
		range,
		storageClass: stored.storageClass,

		/**
		 * Copies the object's HTTP metadata onto response headers, so a handler can serve
		 * a stored object without restating its content type.
		 * @param headers Headers to write into.
		 */
		writeHttpMetadata(headers: Headers): void {
			let metadata = stored.httpMetadata;

			if (metadata.contentType) headers.set("content-type", metadata.contentType);
			if (metadata.contentLanguage) headers.set("content-language", metadata.contentLanguage);
			if (metadata.contentDisposition) {
				headers.set("content-disposition", metadata.contentDisposition);
			}
			if (metadata.contentEncoding) headers.set("content-encoding", metadata.contentEncoding);
			if (metadata.cacheControl) headers.set("cache-control", metadata.cacheControl);
			if (metadata.cacheExpiry) headers.set("expires", metadata.cacheExpiry.toUTCString());
		},
	};
}

/** Builds the readable `R2ObjectBody` view, honouring a resolved byte range. */
function toR2ObjectBody(
	stored: R2StoredObject,
	range?: { offset: number; length: number },
): R2ObjectBody {
	let bytes = range
		? stored.bytes.slice(range.offset, range.offset + range.length)
		: stored.bytes.slice(0);
	let used = false;

	/** Marks the body consumed, so a second read fails like a used `Response` body. */
	function consume(): ArrayBuffer {
		if (used) throw new TypeError("R2: body has already been used");
		used = true;
		return bytes.slice(0);
	}

	return {
		...toR2Object(stored, range),

		/** One-shot stream over the object's bytes. */
		get body(): ReadableStream {
			let buffer = consume();

			return new ReadableStream({
				start(controller) {
					controller.enqueue(new Uint8Array(buffer));
					controller.close();
				},
			});
		},

		/** Whether the body has been read. */
		get bodyUsed(): boolean {
			return used;
		},

		/** Reads the body as bytes. */
		async arrayBuffer(): Promise<ArrayBuffer> {
			return consume();
		},

		/** Reads the body as a byte array. */
		async bytes(): Promise<Uint8Array> {
			return new Uint8Array(consume());
		},

		/** Reads the body as UTF-8 text. */
		async text(): Promise<string> {
			return new TextDecoder().decode(consume());
		},

		/**
		 * Reads and parses the body as JSON.
		 * @template T Expected shape of the parsed value.
		 */
		async json<T>(): Promise<T> {
			return JSON.parse(new TextDecoder().decode(consume())) as T;
		},

		/** Reads the body as a `Blob`, carrying the stored content type. */
		async blob(): Promise<Blob> {
			return new Blob([consume()], { type: stored.httpMetadata.contentType ?? "" });
		},
	};
}

/** Wraps hex digests in the `R2Checksums` shape, exposing MD5 as bytes like R2 does. */
function toR2Checksums(checksums: R2StringChecksums): R2Checksums {
	/** The string form R2 returns from `toJSON`. */
	function toJSON(): R2StringChecksums {
		return { ...checksums };
	}

	if (checksums.md5 === undefined) return { toJSON };

	return { md5: fromHex(checksums.md5), toJSON };
}

/** Computes every digest R2 tracks for a stored object. */
function computeChecksums(bytes: ArrayBuffer): R2StringChecksums {
	return { md5: digest("md5", bytes) };
}

/**
 * Verifies each checksum the caller supplied against the bytes actually received.
 *
 * R2 rejects a mismatched digest rather than storing corrupted data, and reproducing that
 * is the only way a test can cover the failure path.
 */
function verifyChecksums(options: R2PutOptions | undefined, computed: R2StringChecksums): void {
	if (!options) return;

	for (let algorithm of CHECKSUM_ALGORITHMS) {
		let expected = options[algorithm];
		if (expected === undefined) continue;

		let actual = algorithm === "md5" ? computed.md5 : undefined;
		if (actual === undefined) continue;

		if (toHex(expected) !== actual) {
			throw new Error(`R2: the ${algorithm} checksum you specified did not match what we received`);
		}
	}
}

/**
 * Computes one hex digest over the given bytes.
 *
 * `node:crypto` rather than a runtime-specific hasher, because every runner this mock is
 * exercised under provides it and the digests have to be byte-identical across them.
 */
function digest(algorithm: string, bytes: ArrayBuffer): string {
	return createHash(algorithm).update(new Uint8Array(bytes)).digest("hex");
}

/** Normalizes a caller-supplied digest, hex string or bytes, to lowercase hex. */
function toHex(value: (ArrayBuffer | ArrayBufferView) | string): string {
	if (typeof value === "string") return value.toLowerCase();

	let bytes = ArrayBuffer.isView(value)
		? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		: new Uint8Array(value);

	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Decodes a hex digest back into the bytes `R2Checksums` exposes. */
function fromHex(value: string): ArrayBuffer {
	let bytes = new Uint8Array(value.length / 2);

	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
	}

	return bytes.buffer;
}

/** Reads HTTP metadata from either the object form or a `Headers` instance. */
function toHttpMetadata(metadata: R2HTTPMetadata | Headers | undefined): R2HTTPMetadata {
	if (!metadata) return {};
	if (!(metadata instanceof Headers)) return { ...metadata };

	let result: R2HTTPMetadata = {};
	let contentType = metadata.get("content-type");
	let contentLanguage = metadata.get("content-language");
	let contentDisposition = metadata.get("content-disposition");
	let contentEncoding = metadata.get("content-encoding");
	let cacheControl = metadata.get("cache-control");
	let expires = metadata.get("expires");

	if (contentType) result.contentType = contentType;
	if (contentLanguage) result.contentLanguage = contentLanguage;
	if (contentDisposition) result.contentDisposition = contentDisposition;
	if (contentEncoding) result.contentEncoding = contentEncoding;
	if (cacheControl) result.cacheControl = cacheControl;
	if (expires) result.cacheExpiry = new Date(expires);

	return result;
}

/**
 * Resolves any accepted range form into a concrete offset and length.
 *
 * A `suffix` counts back from the end of the object, and an open-ended range runs to the
 * end, matching both the `R2Range` object form and an HTTP `Range` header.
 */
function resolveRange(range: R2Range | Headers, size: number): { offset: number; length: number } {
	if (range instanceof Headers) return resolveRangeHeader(range.get("range"), size);

	if ("suffix" in range && range.suffix !== undefined) {
		let length = Math.min(range.suffix, size);
		return { offset: size - length, length };
	}

	let offset = "offset" in range && range.offset !== undefined ? range.offset : 0;
	let length =
		"length" in range && range.length !== undefined
			? Math.min(range.length, size - offset)
			: size - offset;

	return { offset, length };
}

/** Parses `bytes=…` into an offset and length, treating an absent header as the whole object. */
function resolveRangeHeader(
	header: string | null,
	size: number,
): { offset: number; length: number } {
	if (!header) return { offset: 0, length: size };

	let match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) throw new Error(`R2: unsupported Range header "${header}"`);

	let [, start, end] = match;

	if (start === "") {
		let length = Math.min(Number(end), size);
		return { offset: size - length, length };
	}

	let offset = Number(start);
	if (end === "") return { offset, length: size - offset };

	return { offset, length: Math.min(Number(end) - offset + 1, size - offset) };
}

/** Evaluates an `onlyIf` condition against a stored object. */
function matchesConditional(stored: R2StoredObject, conditional: R2Conditional | Headers): boolean {
	let condition = conditional instanceof Headers ? fromHeaders(conditional) : conditional;
	let uploaded = condition.secondsGranularity
		? new Date(Math.floor(stored.uploaded.getTime() / 1000) * 1000)
		: stored.uploaded;

	if (condition.etagMatches !== undefined && !etagEquals(condition.etagMatches, stored.etag)) {
		return false;
	}

	if (
		condition.etagDoesNotMatch !== undefined &&
		etagEquals(condition.etagDoesNotMatch, stored.etag)
	) {
		return false;
	}

	if (condition.uploadedBefore !== undefined && uploaded > condition.uploadedBefore) return false;
	if (condition.uploadedAfter !== undefined && uploaded < condition.uploadedAfter) return false;

	return true;
}

/**
 * Decides whether a conditional write may create a key that does not exist yet. Only
 * `etagDoesNotMatch: "*"` expresses "write only if absent".
 */
function isAbsentAllowed(conditional: R2Conditional | Headers): boolean {
	let condition = conditional instanceof Headers ? fromHeaders(conditional) : conditional;

	if (condition.etagMatches !== undefined) return false;
	if (condition.uploadedBefore !== undefined || condition.uploadedAfter !== undefined) return false;

	return true;
}

/** Reads a conditional from `If-Match`/`If-None-Match`/`If-Modified-Since` headers. */
function fromHeaders(headers: Headers): R2Conditional {
	let condition: R2Conditional = {};
	let ifMatch = headers.get("if-match");
	let ifNoneMatch = headers.get("if-none-match");
	let ifModifiedSince = headers.get("if-modified-since");
	let ifUnmodifiedSince = headers.get("if-unmodified-since");

	if (ifMatch) condition.etagMatches = ifMatch;
	if (ifNoneMatch) condition.etagDoesNotMatch = ifNoneMatch;
	if (ifModifiedSince) condition.uploadedAfter = new Date(ifModifiedSince);
	if (ifUnmodifiedSince) condition.uploadedBefore = new Date(ifUnmodifiedSince);

	return condition;
}

/** Compares an etag from a condition against a stored etag, ignoring quotes and `*`. */
function etagEquals(candidate: string, etag: string): boolean {
	if (candidate === "*") return true;
	return candidate.replaceAll('"', "") === etag;
}

/**
 * Returns the prefix a key collapses into under a delimiter, or `null` when the key has no
 * delimiter after the listing prefix and so lists as an object.
 */
function findDelimitedPrefix(key: string, prefix: string, delimiter: string): string | null {
	let remainder = key.slice(prefix.length);
	let index = remainder.indexOf(delimiter);

	if (index === -1) return null;

	return prefix + remainder.slice(0, index + delimiter.length);
}

/** Encodes the last key of a page into the opaque cursor R2 hands back. */
function encodeCursor(key: string): string {
	return btoa(key);
}

/** Decodes a cursor into the key a page resumes after. */
function decodeCursor(cursor: string | undefined): string | undefined {
	if (cursor === undefined || cursor === "") return undefined;
	return atob(cursor);
}

/** Joins buffered multipart chunks into one buffer. */
function concatenate(chunks: ArrayBuffer[]): ArrayBuffer {
	let total = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
	let bytes = new Uint8Array(total);
	let offset = 0;

	for (let chunk of chunks) {
		bytes.set(new Uint8Array(chunk), offset);
		offset += chunk.byteLength;
	}

	return bytes.buffer;
}

/** Copies any accepted value into an owned `ArrayBuffer`, draining streams and blobs. */
async function toArrayBuffer(value: R2Value): Promise<ArrayBuffer> {
	if (value === null) return new ArrayBuffer(0);

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
