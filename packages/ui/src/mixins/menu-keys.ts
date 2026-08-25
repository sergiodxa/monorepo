/**
 * Why JS: the WAI-ARIA menu pattern requires roving tabindex, arrow-key
 * navigation, Home/End, and typeahead, which HTML does not provide.
 * No-JS baseline: the Menu surface still opens and closes via the Popover
 * API and its items remain reachable in Tab order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";

import { createMixin, ref } from "remix/ui";

import {
	focusItem,
	isPrintableKey,
	labelFor,
	queryItems,
	setRovingTabindex,
} from "../utils/keyboard-nav";

/** Selector matching a menu item's role, regardless of its checked state. */
const DEFAULT_ITEM_SELECTOR = '[role^="menuitem"]';

/** Idle time after the last keystroke before the typeahead buffer resets. */
const TYPEAHEAD_RESET_MS = 500;

/**
 * Types associated with {@link menuKeys}.
 */
export namespace MenuKeys {
	/**
	 * Configuration accepted by {@link menuKeys}.
	 */
	export interface Options {
		/**
		 * Selector, evaluated against the Menu surface's descendants, that
		 * identifies its menu items. Defaults to `[role^="menuitem"]`, matching
		 * the `menuitem`, `menuitemcheckbox`, and `menuitemradio` roles.
		 */
		itemSelector?: string;
	}
}

/**
 * Reports whether `event`'s closest `role="menu"` ancestor is `host`, so
 * each menu surface — including a nested submenu reusing this same mixin —
 * handles only the events that originate within its own boundary.
 */
function belongsToSurface(event: Event, host: HTMLElement): boolean {
	let target = event.target;
	return target instanceof Element && target.closest('[role="menu"]') === host;
}

/**
 * Index of the currently focused item within `items`, or `-1` when focus
 * sits on the surface itself (or elsewhere) with no item yet active.
 */
function activeIndexOf(host: HTMLElement, items: readonly HTMLElement[]): number {
	let active = host.ownerDocument.activeElement;
	return active instanceof HTMLElement ? items.indexOf(active) : -1;
}

/**
 * Adapts the WAI-ARIA menu keyboard pattern — roving tabindex, arrow-key
 * navigation, Home/End, and typeahead — onto a Menu surface's
 * `[role^="menuitem"]` descendants; only manages focus, leaving activation to native semantics.
 *
 * @param options Item-selector override for non-standard markup.
 * @returns A mixin descriptor for the Menu surface's `mix` prop.
 * @example
 * <Menu.List mix={menuKeys()}>
 * 	<Menu.Item>Rename</Menu.Item>
 * 	<Menu.Item>Delete</Menu.Item>
 * </Menu.List>
 */
export const menuKeys: MixinFactory<HTMLElement, [options?: MenuKeys.Options], ElementProps> =
	createMixin<HTMLElement, [options?: MenuKeys.Options], ElementProps>((_handle) => {
		let buffer = "";
		let resetBufferId: ReturnType<typeof setTimeout> | undefined;

		return (options = {}, props = options as ElementProps) => {
			if (props === options) options = {};

			let selector = options.itemSelector ?? DEFAULT_ITEM_SELECTOR;

			return ref((host: HTMLElement, signal) => {
				let initialItems = queryItems(host, selector);
				if (initialItems.length > 0) setRovingTabindex(initialItems, initialItems[0]!);

				host.addEventListener(
					"focusin",
					(event) => {
						if (!belongsToSurface(event, host)) return;
						let target = event.target;
						if (!(target instanceof HTMLElement)) return;

						let items = queryItems(host, selector);
						if (items.includes(target)) setRovingTabindex(items, target);
					},
					{ signal },
				);

				host.addEventListener(
					"keydown",
					(event) => {
						if (!belongsToSurface(event, host)) return;

						let items = queryItems(host, selector);
						if (items.length === 0) return;

						let index = activeIndexOf(host, items);

						switch (event.key) {
							case "ArrowDown": {
								event.preventDefault();
								let next = index === -1 ? items[0] : items[index + 1];
								if (next) focusItem(items, next);
								return;
							}
							case "ArrowUp": {
								event.preventDefault();
								let previous = index === -1 ? items[items.length - 1] : items[index - 1];
								if (previous) focusItem(items, previous);
								return;
							}
							case "Home":
								event.preventDefault();
								focusItem(items, items[0]!);
								return;
							case "End":
								event.preventDefault();
								focusItem(items, items[items.length - 1]!);
								return;
							case "Backspace":
								buffer = buffer.slice(0, -1);
								return;
						}

						if (!isPrintableKey(event)) return;

						clearTimeout(resetBufferId);
						buffer += event.key.toLowerCase();
						resetBufferId = setTimeout(() => {
							buffer = "";
						}, TYPEAHEAD_RESET_MS);

						let start = index === -1 ? 0 : index + 1;
						let searchOrder = [...items.slice(start), ...items.slice(0, start)];
						let match = searchOrder.find((item) => labelFor(item).startsWith(buffer));
						if (match) focusItem(items, match);
					},
					{ signal },
				);

				signal.addEventListener("abort", () => clearTimeout(resetBufferId));
			});
		};
	});
