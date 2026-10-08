/**
 * Key storage over a Cloudflare R2 bucket, where signing keys outlive every
 * isolate and every Worker issuing tokens for one issuer reads the same files.
 * Each stored object carries the file's name and type, so a key reads back as the `File` written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeyStorage, KeyStorageListOptions, KeyStorageListResult } from "./key-storage.js";

/** The HTTP metadata an object is written and read with. */
interface R2KeyHTTPMetadata {
	contentType?: string;
}

/** A stored object as a read answers it. */
export interface R2KeyObject {
	uploaded: Date;
	httpMetadata?: R2KeyHTTPMetadata;
	customMetadata?: Record<string, string>;
	arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * The parts of an R2 bucket binding the storage uses, declared structurally so
 * importing this module needs no platform types; an `R2Bucket` satisfies it.
 */
export interface R2KeyBucket {
	get(key: string): Promise<R2KeyObject | null>;
	list(options?: KeyStorageListOptions): Promise<{
		objects: { key: string }[];
		truncated: boolean;
		cursor?: string;
	}>;
	put(
		key: string,
		value: ArrayBuffer,
		options?: { httpMetadata?: R2KeyHTTPMetadata; customMetadata?: Record<string, string> },
	): Promise<unknown>;
}

/**
 * Custom metadata written alongside every object. The field names are the ones
 * stored keys already carry, so files written before this module existed read back intact.
 */
interface FileMetadata extends Record<string, string> {
	name: string;
	type: string;
}

/**
 * Adapts an R2 bucket binding to the storage `JWK.signingKeys` reads and rotates
 * keys through. The bucket is passed in, so the caller decides where keys live.
 *
 * @param bucket - The R2 bucket binding key files are stored in.
 * @returns Storage that reads, writes, and pages through key files in that bucket.
 * @example let keys = await JWK.signingKeys(createR2KeyStorage(env.KEYS));
 */
export function createR2KeyStorage(bucket: R2KeyBucket): KeyStorage {
	return {
		/**
		 * A missing key comes back as null, so an object removed between a listing
		 * and its read reads the same as a key that was never there. The bytes are
		 * read fully into memory, which a key file of a few hundred bytes affords.
		 */
		async get(key: string): Promise<File | null> {
			let object = await bucket.get(key);

			if (!object) return null;

			let metadata = object.customMetadata as Partial<FileMetadata> | undefined;

			return new File([await object.arrayBuffer()], metadata?.name ?? key, {
				type: object.httpMetadata?.contentType ?? metadata?.type,
				lastModified: object.uploaded.getTime(),
			});
		},

		/**
		 * Carries R2's cursor only while the page is truncated, so a caller walking
		 * pages until the cursor is gone stops after the last one.
		 */
		async list(options?: KeyStorageListOptions): Promise<KeyStorageListResult> {
			let result = await bucket.list({
				cursor: options?.cursor,
				limit: options?.limit,
				prefix: options?.prefix,
			});

			return {
				files: result.objects.map((object) => ({ key: object.key })),
				cursor: result.truncated ? result.cursor : undefined,
			};
		},

		/** Replaces whatever is stored under the key, recording the file's name and type. */
		async set(key: string, file: File): Promise<void> {
			let metadata: FileMetadata = { name: file.name, type: file.type };

			await bucket.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: file.type },
				customMetadata: metadata,
			});
		},
	};
}
