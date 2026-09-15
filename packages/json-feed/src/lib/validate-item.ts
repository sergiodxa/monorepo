/**
 * Guards the one field JSON Feed 1.1 insists on for an item, since an item a
 * reader cannot recognize again is one it is told to discard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONFeed } from "../index.js";

import { JSONFeedParseError } from "../index.js";

/**
 * Checks that an item carries an id.
 *
 * @param item - The item to check
 * @throws JSONFeedParseError When the id is missing
 */
export function validateItem(item: JSONFeed.Item): void {
	if (!item.id) throw new JSONFeedParseError("Item must include an id.");
}
