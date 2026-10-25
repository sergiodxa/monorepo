/**
 * Validates that an RSS item carries the minimum RSS 2.0 requirement of a
 * title or description.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { RSS } from "../index.js";

import { RSSParseError } from "../index.js";

/**
 * Ensures an item carries the minimum RSS requirement of a title or description.
 *
 * @param item - The item value to validate
 * @returns The item, or an error naming the requirement it misses
 */
export function validateItem<Item extends RSS.ItemBase>(item: Item): Result<Item, RSSParseError> {
	if (!item.title && !item.description) {
		return failure(new RSSParseError("Item must include at least a title or description."));
	}
	return success(item);
}
