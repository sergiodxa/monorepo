/**
 * Serializes a tag list into the `Cache-Tag` header value. It exists for code
 * that assembles headers by hand — jobs writing responses directly, and the
 * middleware — so the deduplication and the size limits are applied once
 * instead of at every place a header is built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CacheTag } from "./types.js";

import { CacheTagError } from "./cache-tag-error.js";
import { MAX_CACHE_TAG_HEADER_LENGTH, TAG_SEPARATOR } from "./platform.js";
import { validateTag } from "./validate-tag.js";

/**
 * Builds the header value for a tag list, dropping repeats while preserving
 * caller order. An empty list is rejected instead of being serialized into a
 * header that would read as tagged while purging nothing.
 *
 * @param tags - Tags from a vocabulary; repeats are collapsed.
 * @returns The comma-separated header value.
 * @throws {CacheTagError} When the list is empty, holds a tag the platform would
 * reject, or serializes beyond the header size limit.
 * @example
 * cacheTag([TAGS.post(post.id), TAGS.postList()]); // "post:1,posts"
 */
export function cacheTag(tags: readonly CacheTag[]): string {
	if (tags.length === 0) {
		throw new CacheTagError("Cannot build a Cache-Tag header from an empty tag list");
	}

	let unique = new Set<string>();
	for (let tag of tags) unique.add(validateTag(tag));

	let value = [...unique].join(TAG_SEPARATOR);
	if (value.length > MAX_CACHE_TAG_HEADER_LENGTH) {
		throw new CacheTagError(
			`A Cache-Tag header cannot exceed ${MAX_CACHE_TAG_HEADER_LENGTH} characters, got ${value.length}`,
		);
	}

	return value;
}
