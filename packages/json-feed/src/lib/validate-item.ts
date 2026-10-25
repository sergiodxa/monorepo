/**
 * Guards the one field JSON Feed 1.1 insists on for an item, since an item a
 * reader cannot recognize again is one it is told to discard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { JSONFeed } from "../index.js";

import { JSONFeedParseError } from "../index.js";

/**
 * Checks that an item carries an id.
 *
 * @param item - The item to check
 * @returns The item, or an error when the id is missing
 */
export function validateItem(item: JSONFeed.Item): Result<JSONFeed.Item, JSONFeedParseError> {
	if (!item.id) return failure(new JSONFeedParseError("Item must include an id."));
	return success(item);
}
