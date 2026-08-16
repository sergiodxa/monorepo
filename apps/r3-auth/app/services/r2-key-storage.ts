/**
 * An R2-backed implementation of the `KeyStorage` contract `JWK.signingKeys` reads
 * signing keys through. R2 is the only place a key file can live and still be visible
 * to every worker issuing tokens for this issuer, but `@pkg/jwt` deliberately knows
 * nothing about buckets, so the mapping from its three operations onto `R2Bucket` has
 * to happen here — against this worker's own generated Workers types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeyStorage, KeyStorageListOptions, KeyStorageListResult } from "@pkg/jwt";

/**
 * Custom metadata written alongside every object, so a stored file can be handed back
 * as the `File` it was stored as.
 *
 * R2 keeps bytes, not filenames: without this the name and type a caller gave the file
 * are lost on the round trip. The names are the ones objects already in the production
 * bucket were written with, so a key file stored before this adapter existed still
 * reads back with its original name.
 */
interface FileMetadata extends Record<string, string> {
	/** The file's name, which R2 does not otherwise keep. */
	name: string;
	/** The file's MIME type, mirrored in the object's HTTP metadata. */
	type: string;
}

/**
 * Adapts an R2 bucket binding to the key storage `@pkg/jwt` expects.
 *
 * A factory over an explicit binding rather than a reach into `env`, so a test can drive
 * it against an in-memory bucket and so the caller decides which bucket keys live in.
 *
 * @param bucket - The R2 bucket binding key files are stored in.
 * @returns Storage that reads, writes, and pages through key files in that bucket.
 * @example let keys = await JWK.signingKeys(createR2KeyStorage(env.R2));
 */
export function createR2KeyStorage(bucket: R2Bucket): KeyStorage {
	return {
		async get(key: string): Promise<File | null> {
			let object = await bucket.get(key);

			// A missing key is an ordinary outcome here — `signingKeys` reads a listing and
			// then fetches each entry, and an object deleted between the two calls has to
			// read as absent rather than throw.
			if (!object) return null;

			let metadata = object.customMetadata as FileMetadata | undefined;

			// The bytes are read whole rather than streamed: `File` needs them in hand, and
			// a key file is a few hundred bytes of JSON.
			return new File([await object.arrayBuffer()], metadata?.name ?? key, {
				type: object.httpMetadata?.contentType ?? metadata?.type,
				lastModified: object.uploaded.getTime(),
			});
		},

		async list(options?: KeyStorageListOptions): Promise<KeyStorageListResult> {
			let result = await bucket.list({
				cursor: options?.cursor,
				limit: options?.limit,
				prefix: options?.prefix,
			});

			return {
				files: result.objects.map((object) => ({ key: object.key })),
				// R2 only carries a cursor on a truncated page, and `signingKeys` walks pages
				// until the cursor is gone — surfacing the last page's cursor would loop.
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
