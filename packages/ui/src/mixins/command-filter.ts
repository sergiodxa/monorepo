/**
 * Search-as-you-type filtering for a Command root: reads the query typed
 * into the marked search input, hands it to a `FilterModel` instance, and
 * mirrors the model's matched set back onto the pre-rendered item list as
 * `hidden`, toggling the empty-state element alongside it.
 *
 * Why JS: matching a typed query against a rendered item list, and hiding
 * everything that doesn't match, requires reading input as it changes and
 * reconciling matches against the DOM — no CSS selector or HTML attribute
 * expresses "descendant text contains this typed value".
 * No-JS baseline: every item and the empty-state element render at once;
 * the full, unfiltered list stays reachable in Tab order and by browser
 * find-in-page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { FilterModel } from "../behaviors/filter-model";

/**
 * Attribute the search input exposes itself on — `Command.Input`'s own
 * `<input>` carries this automatically. `commandFilter()` listens for
 * `input` events bubbling from the element carrying this attribute and
 * forwards the typed value into {@link FilterModel.setQuery}.
 */
export const COMMAND_INPUT_ATTRIBUTE = "data-command-input";

/**
 * Attribute every filterable item exposes itself on — the same `data-value`
 * attribute `Command.Item` already sets from its own `value` prop, so no
 * extra wiring is needed to make a `Command` root's pre-rendered items
 * filterable. Its value doubles as the text compared against the query;
 * `commandFilter()` reads every element carrying this attribute into a
 * {@link FilterModel.Option} and later toggles the same elements' `hidden`
 * property as matches change.
 */
export const COMMAND_ITEM_ATTRIBUTE = "data-value";

/**
 * Attribute the empty-state element exposes itself on — `Command.Empty`
 * carries this automatically. `commandFilter()` toggles its `hidden`
 * property opposite {@link FilterModel.isEmpty}, so it shows only while the
 * current query has no matches.
 */
export const COMMAND_EMPTY_ATTRIBUTE = "data-command-empty";

/**
 * Resolves the id a DOM item correlates to a {@link FilterModel.Option} by:
 * the item's own `id` attribute when set, so it stays usable as an
 * `aria-activedescendant` target for whatever else reads the same model,
 * falling back to its position among the other items otherwise. Exported so
 * a paired mixin — `commandKeys()`, in particular — resolves the exact same
 * id for a given item that `commandFilter()` already put in the model.
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
 * On mount, every item beneath the host carrying {@link COMMAND_ITEM_ATTRIBUTE}
 * is read into `model`'s option set. From then on, every `input` event
 * bubbling from the element carrying {@link COMMAND_INPUT_ATTRIBUTE} updates
 * `model`'s query, and every resulting `"change"` from `model` — from that
 * input, or from anything else that calls a mutating method on the same
 * instance — re-reads the item list and mirrors matches onto it as `hidden`,
 * using the same attribute contract the item and empty-state elements are
 * found by.
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
