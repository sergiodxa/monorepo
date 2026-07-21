/**
 * Shared keyboard-navigation primitives for a flat list of focusable items:
 * collecting a subtree's enabled candidates, assigning roving `tabindex`,
 * moving real DOM focus, detecting a printable keystroke, and normalizing an
 * item's typeahead search text. Backs the WAI-ARIA menu, menubar, and tree
 * keyboard patterns alike, each pairing these primitives with its own
 * traversal, activation, and expand/collapse rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DISABLED_SELECTOR } from "./disabled-selector";

/**
 * Collects `root`'s enabled descendants matching `selector`, in document
 * order. Queried fresh on every keystroke or focus change so a keyboard
 * pattern built on it stays correct as items are added, removed, or toggled
 * disabled while the widget is open.
 *
 * @param root Subtree to search — a menu surface, a menu row's open surface, or any other container of focusable items.
 * @param selector Selector identifying the items to collect.
 * @returns The matching elements, excluding any carrying the native `disabled` attribute or `aria-disabled="true"`.
 * @example
 * queryItems(menuSurface, '[role^="menuitem"]');
 */
export function queryItems(root: HTMLElement, selector: string): HTMLElement[] {
	let candidates = root.querySelectorAll<HTMLElement>(selector);
	return Array.from(candidates).filter((item) => !item.matches(DISABLED_SELECTOR));
}

/**
 * Reports whether `event` is a single, unmodified printable character,
 * matching the WAI-ARIA menu pattern's typeahead trigger.
 *
 * @param event Keyboard event to inspect.
 * @returns `true` when `event.key` is a single character struck with no Ctrl, Alt, or Meta modifier held.
 * @example
 * if (isPrintableKey(event)) buffer += event.key.toLowerCase();
 */
export function isPrintableKey(event: KeyboardEvent): boolean {
	return event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;
}

/**
 * Assigns roving tabindex across `items`: `current` becomes the sole
 * Tab-reachable stop (`tabIndex = 0`) and every other item drops out of Tab
 * order (`tabIndex = -1`).
 *
 * @param items Every item participating in the roving-tabindex group.
 * @param current The item that becomes the sole Tab stop.
 * @example
 * setRovingTabindex(items, items[0]);
 */
export function setRovingTabindex(items: readonly HTMLElement[], current: HTMLElement): void {
	for (let item of items) item.tabIndex = item === current ? 0 : -1;
}

/**
 * Moves roving tabindex and real DOM focus to `item`.
 *
 * @param items Every item participating in the roving-tabindex group.
 * @param item The item to focus.
 * @example
 * focusItem(items, items[0]);
 */
export function focusItem(items: readonly HTMLElement[], item: HTMLElement): void {
	setRovingTabindex(items, item);
	item.focus();
}

/**
 * Normalizes an item's typeahead text: its `data-search-value` override when
 * the visible content isn't the best match text, otherwise its trimmed,
 * lowercased text content.
 *
 * @param item The item to read typeahead text from.
 * @returns The item's lowercased, trimmed typeahead text.
 * @example
 * searchOrder.find((item) => labelFor(item).startsWith(buffer));
 */
export function labelFor(item: HTMLElement): string {
	let searchValue = item.getAttribute("data-search-value");
	return (searchValue ?? item.textContent ?? "").trim().toLowerCase();
}
