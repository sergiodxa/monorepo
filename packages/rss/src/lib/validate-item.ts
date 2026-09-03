/**
 * Validates that an RSS item carries the minimum RSS 2.0 requirement of a
 * title or description.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RSS } from "../index.js";

/**
 * Ensures items preserve the minimum RSS requirement of a title or description.
 *
 * @param item - The item value to validate
 */
export function validateItem(item: RSS.ItemBase): void {
	if (!item.title && !item.description) {
		throw new Error("Item must include at least a title or description.");
	}
}
