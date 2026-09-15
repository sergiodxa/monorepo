/**
 * Guards the fields JSON Feed 1.1 requires of every feed, so an instance can
 * never hold data that would serialize into a document a reader rejects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONFeed } from "../index.js";

import { JSONFeedParseError } from "../index.js";

/**
 * Checks that a feed carries a title.
 *
 * @param feed - The feed to check
 * @throws JSONFeedParseError When the title is missing
 */
export function validateFeed(feed: JSONFeed.Feed): void {
	if (!feed.title) throw new JSONFeedParseError("Feed must include a title.");
}
