/**
 * The rendered social cards, kept in R2 behind `remix/file-storage`'s `FileStorage`, so the
 * image route reads and writes `File`s and a test can stand in any other backend. A card is
 * stored once per template and content and never rewritten.
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

import { env } from "cloudflare:workers";

/**
 * A `FileStorage` over an R2 bucket. A file's name and modification time travel as custom
 * metadata and its type as the object's content type, so a file reads back exactly as it
 * was stored.
 */
export class R2FileStorage implements FileStorage {
	#bucket: R2Bucket;

	constructor(bucket: R2Bucket) {
		this.#bucket = bucket;
	}

	/** The stored file, or `null` when the key holds nothing. */
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

/** The storage the image route keeps rendered cards in. */
export function socialCards(): FileStorage {
	return new R2FileStorage(env.SOCIAL_CARDS);
}

/** When the file was last modified, falling back to when R2 received it. */
function lastModifiedOf(object: R2Object): number {
	let stored = Number(object.customMetadata?.lastModified);
	return Number.isFinite(stored) ? stored : object.uploaded.getTime();
}
