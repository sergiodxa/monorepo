/**
 * A `remix/file-storage` `FileStorage` over a Cloudflare R2 bucket, so code that reads and
 * writes `File`s keeps working against R2 in a Worker and any other backend in a test. A
 * file's name, modification time and type travel with the object and read back intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	FileKey,
	FileMetadata,
	FileStorage,
	ListOptions,
	ListResult,
} from "remix/file-storage";

/** A stored object as a `head` or a listing answers it. */
export interface R2FileObject {
	key: string;
	size: number;
	uploaded: Date;
	httpMetadata?: { contentType?: string };
	customMetadata?: Record<string, string>;
}

/**
 * The parts of an R2 bucket binding the storage calls, declared structurally so the package
 * typechecks in any project; an `R2Bucket` from `wrangler types` or `@cloudflare/workers-types`
 * satisfies it.
 */
export interface R2FileBucket {
	get(key: string): Promise<(R2FileObject & { arrayBuffer(): Promise<ArrayBuffer> }) | null>;
	head(key: string): Promise<R2FileObject | null>;
	list(options?: {
		prefix?: string;
		cursor?: string;
		limit?: number;
		include?: ("httpMetadata" | "customMetadata")[];
	}): Promise<{ objects: R2FileObject[]; truncated: boolean; cursor?: string }>;
	put(
		key: string,
		value: ArrayBuffer,
		options?: {
			httpMetadata?: { contentType?: string };
			customMetadata?: Record<string, string>;
		},
	): Promise<unknown>;
	delete(key: string): Promise<void>;
}

/**
 * A `FileStorage` over an R2 bucket. A file's name and modification time travel as custom
 * metadata and its type as the object's content type, so a file reads back exactly as it
 * was stored; an object written without them reads back named by its key.
 *
 * @example let storage = new R2FileStorage(env.UPLOADS);
 */
export class R2FileStorage implements FileStorage {
	#bucket: R2FileBucket;

	/** @param bucket - The R2 bucket binding files are stored in. */
	constructor(bucket: R2FileBucket) {
		this.#bucket = bucket;
	}

	/** The stored file, read whole into memory, or `null` when the key holds nothing. */
	async get(key: string): Promise<File | null> {
		let object = await this.#bucket.get(key);
		if (!object) return null;
		return new File([await object.arrayBuffer()], object.customMetadata?.name ?? key, {
			type: object.httpMetadata?.contentType ?? "",
			lastModified: lastModifiedOf(object),
		});
	}

	/** Checks with a `HEAD`, so asking costs no body transfer. */
	async has(key: string): Promise<boolean> {
		return (await this.#bucket.head(key)) !== null;
	}

	/** Pages through the bucket in key order; a `cursor` in the result means more remain. */
	async list<T extends ListOptions>(options?: T): Promise<ListResult<T>> {
		let result = await this.#bucket.list({
			prefix: options?.prefix,
			cursor: options?.cursor,
			limit: options?.limit,
			include: options?.includeMetadata ? ["httpMetadata", "customMetadata"] : [],
		});
		let files = result.objects.map((object): FileKey | FileMetadata =>
			options?.includeMetadata
				? {
						key: object.key,
						lastModified: lastModifiedOf(object),
						name: object.customMetadata?.name ?? object.key,
						size: object.size,
						type: object.httpMetadata?.contentType ?? "",
					}
				: { key: object.key },
		);
		return { cursor: result.truncated ? result.cursor : undefined, files } as ListResult<T>;
	}

	/** Stores the file and returns it as read back from the bucket. */
	async put(key: string, file: File): Promise<File> {
		await this.set(key, file);
		return (await this.get(key)) ?? file;
	}

	/** Deletes the object; removing a key that holds nothing succeeds. */
	async remove(key: string): Promise<void> {
		await this.#bucket.delete(key);
	}

	/** Stores the file, replacing whatever the key held. */
	async set(key: string, file: File): Promise<void> {
		await this.#bucket.put(key, await file.arrayBuffer(), {
			httpMetadata: { contentType: file.type },
			customMetadata: { name: file.name, lastModified: String(file.lastModified) },
		});
	}
}

/** When the file was last modified, falling back to when R2 received it. */
function lastModifiedOf(object: R2FileObject): number {
	let stored = Number(object.customMetadata?.lastModified);
	return Number.isFinite(stored) ? stored : object.uploaded.getTime();
}
