/**
 * Entity tag generation: a validator derived from the bytes of a response, so a
 * client holding a current copy is answered with a `304` instead of the body.
 * The digest comes from `@pkg/crypto`, keeping the hash implementation shared.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike, CryptoError } from "@pkg/crypto";
import type { Result } from "@pkg/result";

import { Base64Url, sha256 } from "@pkg/crypto";
import { isFailure, success } from "@pkg/result";

/**
 * How strictly the tag identifies the bytes it was built from.
 */
export interface EtagOptions {
	/**
	 * Mark the tag weak (`W/"…"`), meaning it identifies content that is
	 * semantically equivalent, tolerating minor representation differences.
	 */
	weak?: boolean;
}

/**
 * Derives an entity tag from a payload by hashing it with SHA-256. The tag is
 * base64url of the digest, quoted, so it changes whenever the bytes do — the
 * property that makes an `ETag` a safe cache validator.
 *
 * @param body - The bytes the tag must identify; text is read as UTF-8.
 * @param options - Set `weak: true` for content that varies insignificantly
 * between renders, such as server-rendered HTML carrying a timestamp.
 * @returns The quoted entity tag, or the digest failure from the runtime.
 *
 * @example
 * let tag = await etag(body);
 * if (isSuccess(tag)) headers.set("ETag", tag.data);
 * @example
 * let tag = await etag(html, { weak: true }); // W/"47DEQpj8HBSa…"
 */
export async function etag(
	body: BinaryLike,
	options: EtagOptions = {},
): Promise<Result<string, CryptoError>> {
	let digest = await sha256(body);
	if (isFailure(digest)) return digest;

	let tag = `"${Base64Url.encode(digest.data)}"`;

	return success(options.weak ? `W/${tag}` : tag);
}
