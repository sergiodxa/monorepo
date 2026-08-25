/**
 * The single gate a string passes through to become a `CacheTag`. Every builder
 * a vocabulary returns and every serialization runs through it, so a tag the
 * platform would drop is rejected at the point it was written, keeping every
 * purge call matched against a tag the platform actually recognizes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CacheTag } from "./types";

import { CacheTagError } from "./cache-tag-error";
import { FORBIDDEN_TAG_CHARACTERS, MAX_TAG_LENGTH, PRINTABLE_ASCII_PATTERN } from "./platform";

/**
 * Validates a tag against the platform's character set and length rules and
 * brands it, so the value can be used where a `CacheTag` is required.
 *
 * @param value - The tag a vocabulary builder produced.
 * @returns The same string, branded as a validated tag.
 * @throws {CacheTagError} When the tag is empty, too long, or contains a
 * character the platform does not accept.
 * @example
 * validateTag("post:123"); // "post:123" as CacheTag
 */
export function validateTag(value: string): CacheTag {
	if (value.length === 0) throw new CacheTagError("A cache tag cannot be empty");

	if (value.length > MAX_TAG_LENGTH) {
		throw new CacheTagError(`A cache tag cannot exceed ${MAX_TAG_LENGTH} characters`, value);
	}

	if (!PRINTABLE_ASCII_PATTERN.test(value)) {
		throw new CacheTagError("A cache tag must be printable ASCII", value);
	}

	for (let character of FORBIDDEN_TAG_CHARACTERS) {
		if (!value.includes(character)) continue;
		throw new CacheTagError(`A cache tag cannot contain ${JSON.stringify(character)}`, value);
	}

	return value as CacheTag;
}
