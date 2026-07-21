/**
 * Unit tests for the shared keyboard-navigation primitives in
 * {@link "./keyboard-nav"}: every assertion drives a minimal object standing
 * in for an `HTMLElement` or a `KeyboardEvent` — carrying only the members
 * each function reads — with no DOM and no rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { focusItem, isPrintableKey, labelFor, queryItems, setRovingTabindex } from "./keyboard-nav";

/**
 * Builds a minimal stand-in for an `HTMLElement`, carrying only the members
 * {@link "./keyboard-nav"}'s functions read or write.
 */
function createItem(
	overrides: {
		disabled?: boolean;
		searchValue?: string | null;
		textContent?: string | null;
	} = {},
): HTMLElement {
	let disabled = overrides.disabled ?? false;

	return {
		tabIndex: -1,
		focus: mock(() => {}),
		matches: (selector: string) => disabled && selector === ':disabled, [aria-disabled="true"]',
		getAttribute: (name: string) =>
			name === "data-search-value" ? (overrides.searchValue ?? null) : null,
		textContent: overrides.textContent ?? null,
	} as unknown as HTMLElement;
}

/**
 * Builds a minimal stand-in for a `KeyboardEvent`, carrying only the members
 * {@link isPrintableKey} reads.
 */
function createKeyEvent(overrides: {
	key: string;
	ctrlKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
}): KeyboardEvent {
	return {
		key: overrides.key,
		ctrlKey: overrides.ctrlKey ?? false,
		altKey: overrides.altKey ?? false,
		metaKey: overrides.metaKey ?? false,
	} as unknown as KeyboardEvent;
}

describe(queryItems.name, () => {
	test("returns every element matching the selector, in document order", () => {
		let first = createItem();
		let second = createItem();
		let root = {
			querySelectorAll: mock(() => [first, second]),
		} as unknown as HTMLElement;

		expect(queryItems(root, '[role^="menuitem"]')).toEqual([first, second]);
	});

	test("passes the selector straight through to querySelectorAll", () => {
		let querySelectorAll = mock(() => []);
		let root = { querySelectorAll } as unknown as HTMLElement;

		queryItems(root, '[role="menuitem"]');

		expect(querySelectorAll).toHaveBeenCalledWith('[role="menuitem"]');
	});

	test("excludes an element carrying the native disabled attribute or aria-disabled", () => {
		let enabled = createItem({ disabled: false });
		let disabled = createItem({ disabled: true });
		let root = {
			querySelectorAll: mock(() => [enabled, disabled]),
		} as unknown as HTMLElement;

		expect(queryItems(root, "*")).toEqual([enabled]);
	});

	test("returns an empty array when nothing matches", () => {
		let root = { querySelectorAll: mock(() => []) } as unknown as HTMLElement;

		expect(queryItems(root, "*")).toEqual([]);
	});
});

describe(isPrintableKey.name, () => {
	test("is true for a single unmodified character", () => {
		expect(isPrintableKey(createKeyEvent({ key: "a" }))).toBe(true);
	});

	test("is false for a multi-character key name", () => {
		expect(isPrintableKey(createKeyEvent({ key: "Enter" }))).toBe(false);
		expect(isPrintableKey(createKeyEvent({ key: "ArrowDown" }))).toBe(false);
	});

	test("is false when Ctrl, Alt, or Meta is held", () => {
		expect(isPrintableKey(createKeyEvent({ key: "a", ctrlKey: true }))).toBe(false);
		expect(isPrintableKey(createKeyEvent({ key: "a", altKey: true }))).toBe(false);
		expect(isPrintableKey(createKeyEvent({ key: "a", metaKey: true }))).toBe(false);
	});
});

describe(setRovingTabindex.name, () => {
	test("makes current the sole Tab stop and drops every other item out of Tab order", () => {
		let first = createItem();
		let second = createItem();
		let third = createItem();
		let items = [first, second, third];

		setRovingTabindex(items, second);

		expect(first.tabIndex).toBe(-1);
		expect(second.tabIndex).toBe(0);
		expect(third.tabIndex).toBe(-1);
	});

	test("assigns -1 to every item when current isn't among them", () => {
		let first = createItem();
		let second = createItem();

		setRovingTabindex([first, second], createItem());

		expect(first.tabIndex).toBe(-1);
		expect(second.tabIndex).toBe(-1);
	});
});

describe(focusItem.name, () => {
	test("assigns roving tabindex and moves real focus to item", () => {
		let first = createItem();
		let second = createItem();
		let items = [first, second];

		focusItem(items, second);

		expect(first.tabIndex).toBe(-1);
		expect(second.tabIndex).toBe(0);
		expect(second.focus).toHaveBeenCalledTimes(1);
		expect(first.focus).not.toHaveBeenCalled();
	});
});

describe(labelFor.name, () => {
	test("uses the data-search-value override when set", () => {
		let item = createItem({ searchValue: "Delete Item", textContent: "Delete" });

		expect(labelFor(item)).toBe("delete item");
	});

	test("falls back to trimmed, lowercased text content when there's no override", () => {
		let item = createItem({ textContent: "  Rename  " });

		expect(labelFor(item)).toBe("rename");
	});

	test("returns an empty string when neither the override nor text content is set", () => {
		let item = createItem({ textContent: null });

		expect(labelFor(item)).toBe("");
	});
});
