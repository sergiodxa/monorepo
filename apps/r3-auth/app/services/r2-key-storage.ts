/**
 * An R2-backed implementation of the `KeyStorage` contract `JWK.signingKeys`
 * reads signing keys through. R2 is the only place a key file can live and
 * still be visible to every worker issuing tokens for this issuer, and
 * `@sdxc/jwt`'s three operations are generic across storage backends, so the
 * mapping onto `R2Bucket` happens here — against this worker's own generated Workers types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeyStorage, KeyStorageListOptions, KeyStorageListResult } from "@sdxc/jwt";

/**
 * Custom metadata written alongside every object, so a stored file can be
 * handed back as the `File` it was stored as. The field names match what
 * objects already in the production bucket were written with, so older files still read back correctly.
 */
interface FileMetadata extends Record<string, string> {
	/** The file's name, carried here since R2 stores only bytes. */
	name: string;
	/** The file's MIME type, mirrored in the object's HTTP metadata. */
	type: string;
}

/**
 * Adapts an R2 bucket binding to the key storage `@sdxc/jwt` expects.
 *
 * Takes the bucket as an explicit parameter, so a test can drive it against
 * an in-memory bucket and the caller decides which bucket keys live in.
 *
 * @param bucket - The R2 bucket binding key files are stored in.
 * @returns Storage that reads, writes, and pages through key files in that bucket.
 * @example let keys = await JWK.signingKeys(createR2KeyStorage(env.R2));
 */
export function createR2KeyStorage(bucket: R2Bucket): KeyStorage {
	return {
		/**
		 * A missing key comes back as null. `signingKeys` lists then fetches each
		 * entry, so an object removed between those two calls reads the same as a
		 * key that was never there.
		 *
		 * @param key - The stored object's key.
		 * @returns The stored file, its bytes read fully into memory — `File` needs
		 * them in hand, and a key file is only a few hundred bytes of JSON.
		 */
		async get(key: string): Promise<File | null> {
			let object = await bucket.get(key);

			if (!object) return null;

			let metadata = object.customMetadata as FileMetadata | undefined;

			return new File([await object.arrayBuffer()], metadata?.name ?? key, {
				type: object.httpMetadata?.contentType ?? metadata?.type,
				lastModified: object.uploaded.getTime(),
			});
		},

		/**
		 * R2 marks a cursor only on a truncated page. `signingKeys` walks pages
		 * until the cursor is gone, so this omits it once the last page is
		 * reached, ending the walk.
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

		async set(key: string, file: File): Promise<void> {
			let metadata: FileMetadata = { name: file.name, type: file.type };

			await bucket.put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: file.type },
				customMetadata: metadata,
			});
		},
	};
}
