/**
 * Invalidation for callers that have no request: queue consumers, scheduled
 * handlers, and any job that rewrote content. The cache interface is a parameter
 * rather than a global so this module stays runtime-free, and the outcome is a
 * `Result` because a purge that failed means stale content is still being served.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { CacheInterface, PurgeOptions, PurgeSelector } from "./types.js";

import { PurgeError } from "./purge-error.js";
import { validateTag } from "./validate-tag.js";

/**
 * Normalizes purge options into the selector the platform receives, collapsing
 * repeated tags and rejecting the forms that would invalidate nothing.
 *
 * @param options - The caller's purge form.
 * @returns The selector to send, or a failure explaining why nothing was selected.
 */
function toSelector(options: PurgeOptions): Result<PurgeSelector, PurgeError> {
	if ("tags" in options) {
		if (options.tags.length === 0) {
			return failure(new PurgeError("Cannot purge an empty tag list; pass at least one tag"));
		}

		let unique = new Set<string>();
		try {
			for (let tag of options.tags) unique.add(validateTag(tag));
		} catch (error) {
			return failure(new PurgeError("Cannot purge an invalid tag", { cause: error }));
		}

		return success({ tags: [...unique] });
	}

	if ("prefix" in options) {
		if (options.prefix.trim().length === 0) {
			return failure(new PurgeError("Cannot purge an empty prefix"));
		}
		return success({ prefix: options.prefix });
	}

	if (options.everything) return success({ everything: true });

	return failure(new PurgeError("Purge options selected nothing to invalidate"));
}

/**
 * Describes a selector for an error message, so a failed purge names what stayed
 * stale instead of reporting a bare platform error.
 *
 * @param selector - The selector that was sent.
 * @returns A short human-readable description.
 */
function describe(selector: PurgeSelector): string {
	if (selector.tags) return `tags ${selector.tags.join(", ")}`;
	if (selector.prefix) return `prefix ${selector.prefix}`;
	return "everything";
}

/**
 * Invalidates cached entries by tag, by URL prefix, or entirely.
 *
 * Purging is eventually consistent: a success confirms platform acceptance, with
 * edge reads converging shortly after; reserve `everything` for incident response.
 *
 * @param cache - The platform cache interface, or a double in tests.
 * @param options - Exactly one of tags, a prefix, or everything.
 * @returns Success when the platform accepted the purge, otherwise a `PurgeError`
 * carrying the selector that did not take effect.
 * @example
 * await purge(cache, { tags: [TAGS.post(id), TAGS.postList()] });
 * @example
 * await purge(cache, { prefix: "example.com/blog/" });
 * @example
 * await purge(cache, { everything: true }); // incidents only
 */
export async function purge(
	cache: CacheInterface,
	options: PurgeOptions,
): Promise<Result<void, PurgeError>> {
	let selector = toSelector(options);
	if (isFailure(selector)) return selector;

	try {
		await cache.purge(selector.data);
		return success(undefined);
	} catch (error) {
		return failure(
			new PurgeError(`Cache purge failed for ${describe(selector.data)}`, {
				selector: selector.data,
				cause: error,
			}),
		);
	}
}
