/**
 * Search-as-you-type filtering for a Command root: reads the query typed
 * into the marked search input, hands it to a `FilterModel` instance, and
 * mirrors the matched set onto the pre-rendered items as `hidden`,
 * toggling the empty-state element. Without JS every item and the
 * empty-state element render at once, reachable in Tab order and find-in-page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { FilterModel } from "../behaviors/filter-model.js";

/**
 * Attribute the search input exposes itself on — `Command.Input`'s own
 * `<input>` carries this automatically, and `commandFilter()` forwards its
 * typed value into {@link FilterModel.setQuery}.
 */
export const COMMAND_INPUT_ATTRIBUTE = "data-command-input";

/**
 * Attribute every filterable item exposes itself on — the same `data-value`
 * attribute `Command.Item` already sets, so pre-rendered items need no
 * extra wiring to become filterable; its value is matched against the query.
 */
export const COMMAND_ITEM_ATTRIBUTE = "data-value";

/**
 * Attribute the empty-state element exposes itself on — `Command.Empty`
 * carries this automatically. `commandFilter()` toggles its `hidden`
 * property opposite {@link FilterModel.isEmpty}.
 */
export const COMMAND_EMPTY_ATTRIBUTE = "data-command-empty";

/**
 * Resolves the id a DOM item correlates to a {@link FilterModel.Option}:
 * its own `id` attribute when set, doubling as an `aria-activedescendant`
 * target, otherwise its position among the other items.
 *
 * @param item Item element read from the DOM.
 * @param index Item's position among the other items carrying {@link COMMAND_ITEM_ATTRIBUTE}.
 * @returns The id to correlate this item with in the model's option set.
 */
export function getCommandItemId(item: HTMLElement, index: number): string {
	return item.id !== "" ? item.id : String(index);
}

/**
 * Reads every item beneath `root` into the option set a `FilterModel`
 * filters over, using each item's own text when {@link COMMAND_ITEM_ATTRIBUTE}
 * carries no value.
 *
 * @param root Command root element the items are read from.
 * @returns The current option set, in document order.
 */
function collectOptions(root: HTMLElement): FilterModel.Option[] {
	let items = root.querySelectorAll<HTMLElement>(`[${COMMAND_ITEM_ATTRIBUTE}]`);
	let options: FilterModel.Option[] = [];

	for (let [index, item] of items.entries()) {
		let value = item.getAttribute(COMMAND_ITEM_ATTRIBUTE) || item.textContent?.trim() || "";
		options.push({ id: getCommandItemId(item, index), value });
	}

	return options;
}

/**
 * Mirrors a `FilterModel`'s matched set onto the item list beneath `root`
 * as `hidden`, and toggles the empty-state element opposite
 * {@link FilterModel.isEmpty}.
 *
 * @param root Command root element the items and empty-state element are read from.
 * @param model Model whose current matches and empty state get mirrored onto the DOM.
 */
function syncMatches(root: HTMLElement, model: FilterModel): void {
	let items = root.querySelectorAll<HTMLElement>(`[${COMMAND_ITEM_ATTRIBUTE}]`);

	for (let [index, item] of items.entries()) {
		item.hidden = !model.isMatch(getCommandItemId(item, index));
	}

	let empty = root.querySelector<HTMLElement>(`[${COMMAND_EMPTY_ATTRIBUTE}]`);
	if (empty !== null) empty.hidden = !model.isEmpty;
}

/**
 * Filters a Command root's pre-rendered items as the user types, hiding
 * everything that doesn't match the current query and toggling the
 * empty-state element when nothing does.
 *
 * @param model Behavior class instance owning the query, matched option set, and active option.
 * @example
 * let model = new FilterModel();
 * <Command mix={commandFilter(model)}>
 * 	<Command.Input />
 * 	<Command.Item id="home" value="Home">Home</Command.Item>
 * 	<Command.Item id="settings" value="Settings">Settings</Command.Item>
 * 	<Command.Empty>No matches</Command.Empty>
 * </Command>
 */
export const commandFilter = createMixin<HTMLElement, [model: FilterModel]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundModel: FilterModel | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
		boundModel?.setOptions(collectOptions(hostNode));
	});

	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	return (model) => {
		if (boundModel !== model) {
			boundModel = model;
			model.addEventListener(
				"change",
				() => {
					if (hostNode !== undefined) syncMatches(hostNode, model);
				},
				{ signal: handle.signal },
			);
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "input">("input", (event) => {
					if (!(event.target instanceof HTMLInputElement)) return;
					if (!event.target.hasAttribute(COMMAND_INPUT_ATTRIBUTE)) return;
					model.setQuery(event.target.value);
				}),
			],
		});
	};
});
