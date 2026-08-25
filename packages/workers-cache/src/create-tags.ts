/**
 * Turns a plain object of tag builders into an app's tag vocabulary: the one
 * place a tag's shape is written down, validated on every call, and branded so
 * the response header and the purge that clears it cannot drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CacheTag } from "./types";

import { validateTag } from "./validate-tag";

/**
 * The shape a vocabulary declaration takes: named builders that render a tag
 * from whatever identifies the content, or from nothing for a collection tag.
 */
export interface TagVocabulary {
	[name: string]: (...args: never[]) => string;
}

/**
 * The vocabulary `createTags()` returns: the same names and parameters, with the
 * return type narrowed to a validated {@link CacheTag}.
 */
export type CacheTags<Vocabulary extends TagVocabulary> = {
	readonly [name in keyof Vocabulary]: (...args: Parameters<Vocabulary[name]>) => CacheTag;
};

/**
 * Wraps each builder in a validating one, so an invalid tag throws where it is
 * built rather than at the edge. The returned builders are the only way to get
 * a `CacheTag`, so a renamed or mistyped tag becomes a compile error at purge.
 *
 * @param vocabulary - Named builders returning the raw tag string.
 * @returns The same vocabulary, returning validated tags.
 * @throws {CacheTagError} From a builder, when the tag it produced is invalid.
 * @example
 * let TAGS = createTags({ post: (id: string) => `post:${id}`, postList: () => "posts" });
 * @example
 * TAGS.post("123"); // "post:123", branded as a CacheTag
 */
export function createTags<Vocabulary extends TagVocabulary>(
	vocabulary: Vocabulary,
): CacheTags<Vocabulary> {
	let tags: Record<string, (...args: never[]) => CacheTag> = {};

	for (let name of Object.keys(vocabulary)) {
		let build = vocabulary[name];
		if (!build) continue;
		tags[name] = (...args: never[]) => validateTag(build(...args));
	}

	return tags as CacheTags<Vocabulary>;
}
