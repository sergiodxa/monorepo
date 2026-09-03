/**
 * Arrow-key and Enter navigation for a Command root already paired with
 * `commandFilter(model)`: arrow keys move `model`'s active match across the
 * visible items, mirrored onto `aria-selected` and `aria-activedescendant`;
 * Enter clicks whatever control the active item nests. Without JS every
 * item stays independently activatable in ordinary Tab order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { FilterModel } from "../behaviors/filter-model.js";

import {
	COMMAND_INPUT_ATTRIBUTE,
	COMMAND_ITEM_ATTRIBUTE,
	getCommandItemId,
} from "./command-filter.js";

/** `KeyboardEvent.key` value that moves the active match to the previous visible option. */
const ARROW_UP_KEY = "ArrowUp";

/** `KeyboardEvent.key` value that moves the active match to the next visible option. */
const ARROW_DOWN_KEY = "ArrowDown";

/** `KeyboardEvent.key` value that activates the current active match. */
const ENTER_KEY = "Enter";

/**
 * Mirrors `model`'s active match onto every item beneath `root` as
 * `aria-selected` and onto the search input as `aria-activedescendant`,
 * scrolling the active item into view past {@link Command.List}'s scroll boundary.
 *
 * @param root Command root element the items and search input are read from.
 * @param model Model whose current active match gets mirrored onto the DOM.
 */
function syncActive(root: HTMLElement, model: FilterModel): void {
	let items = root.querySelectorAll<HTMLElement>(`[${COMMAND_ITEM_ATTRIBUTE}]`);
	let activeItem: HTMLElement | undefined;

	for (let [index, item] of items.entries()) {
		let isActive = getCommandItemId(item, index) === model.activeId;

		item.setAttribute("aria-selected", String(isActive));
		if (isActive) activeItem = item;
	}

	let input = root.querySelector<HTMLElement>(`[${COMMAND_INPUT_ATTRIBUTE}]`);
	if (input !== null) input.setAttribute("aria-activedescendant", model.activeId ?? "");

	activeItem?.scrollIntoView({ block: "nearest" });
}

/**
 * Finds the item beneath `root` whose resolved id matches `model.activeId`
 * and clicks whatever button or link its own children nest for activation.
 *
 * @param root Command root element the active item is read from.
 * @param model Model naming which item is currently active.
 */
function activateCurrent(root: HTMLElement, model: FilterModel): void {
	if (model.activeId === null) return;

	let items = root.querySelectorAll<HTMLElement>(`[${COMMAND_ITEM_ATTRIBUTE}]`);

	for (let [index, item] of items.entries()) {
		if (getCommandItemId(item, index) !== model.activeId) continue;

		item.querySelector<HTMLElement>("a, button")?.click();
		return;
	}
}

/**
 * Adds ArrowDown/ArrowUp/Enter navigation to a Command root already paired
 * with `commandFilter(model)`, mirroring the active match onto
 * `aria-selected` and `aria-activedescendant`, and activating it on Enter.
 *
 * @param model The same `FilterModel` instance passed to `commandFilter()`.
 * @example
 * let model = new FilterModel();
 * <Command mix={[commandFilter(model), commandKeys(model)]}>
 * 	<Command.Input />
 * 	<Command.Item id="home" value="Home">
 * 		<a href="/">Home</a>
 * 	</Command.Item>
 * 	<Command.Item id="settings" value="Settings">
 * 		<a href="/settings">Settings</a>
 * 	</Command.Item>
 * 	<Command.Empty>No matches</Command.Empty>
 * </Command>
 */
export const commandKeys = createMixin<HTMLElement, [model: FilterModel]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundModel: FilterModel | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
		if (boundModel !== undefined) syncActive(hostNode, boundModel);
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
					if (hostNode !== undefined) syncActive(hostNode, model);
				},
				{ signal: handle.signal },
			);
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "keydown">("keydown", (event) => {
					if (event.key === ARROW_DOWN_KEY) {
						event.preventDefault();
						model.moveNext();
					} else if (event.key === ARROW_UP_KEY) {
						event.preventDefault();
						model.movePrevious();
					} else if (event.key === ENTER_KEY && hostNode !== undefined) {
						event.preventDefault();
						activateCurrent(hostNode, model);
					}
				}),
			],
		});
	};
});
