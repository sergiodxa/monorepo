/**
 * Guards the fields JSON Feed 1.1 requires of every feed, so an instance can
 * never hold data that would serialize into a document a reader rejects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { JSONFeed } from "../index.js";

import { JSONFeedParseError } from "../index.js";

/**
 * Checks that a feed carries a title.
 *
 * @param feed - The feed to check
 * @returns The feed, or an error when the title is missing
 */
export function validateFeed(feed: JSONFeed.Feed): Result<JSONFeed.Feed, JSONFeedParseError> {
	if (!feed.title) return failure(new JSONFeedParseError("Feed must include a title."));
	return success(feed);
}
