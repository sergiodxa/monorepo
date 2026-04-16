import type { RSS } from "../index";

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
