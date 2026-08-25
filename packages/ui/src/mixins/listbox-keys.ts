/**
 * Adapts `remix/ui/listbox`'s ARIA listbox keyboard pattern onto a ListBox's
 * option-list host, delegating arrow keys, `Home`/`End`, typeahead, and
 * `Enter`/`Space` to `remix/ui/listbox`'s own `list()` primitive, and reports
 * the shared context's selected value and active option as a typed event.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createMixin } from "remix/ui";
import * as listbox from "remix/ui/listbox";

import { trackHostNode } from "./track-host-node";

/** DOM event type dispatched by {@link listboxKeys} whenever the selected value or the active option changes. */
const LISTBOX_CHANGE_EVENT = "ui:listbox-change" as const;

declare global {
	interface HTMLElementEventMap {
		[LISTBOX_CHANGE_EVENT]: ListboxChangeEvent;
	}
}

/**
 * Dispatched on a ListBox's option-list host by {@link listboxKeys}
 * whenever the shared context's selected value or active option moves, so
 * a consumer can react without reading that context directly.
 */
export class ListboxChangeEvent extends Event {
	/** Value the listbox currently reports as selected, or `null` when nothing is selected. */
	readonly value: listbox.ListboxValue;
	/** Value of the option currently active for keyboard and pointer navigation, or `null` when none is active. */
	readonly activeValue: listbox.ListboxValue;

	/**
	 * @param init Snapshot of the listbox's selection state at dispatch time.
	 */
	constructor(init: { value: listbox.ListboxValue; activeValue: listbox.ListboxValue }) {
		super(LISTBOX_CHANGE_EVENT, { bubbles: true });
		this.value = init.value;
		this.activeValue = init.activeValue;
	}
}

/**
 * Turns a ListBox's option-list host into the ARIA listbox keyboard surface
 * by delegating to `remix/ui/listbox`'s `list()` primitive. Use it inside an
 * ancestor `listbox.Context` alongside a matching `option()` mixin.
 *
 * @example
 * <listbox.Context value={value} activeValue={activeValue} onSelect={onSelect} onHighlight={onHighlight}>
 *   <div role="listbox" aria-label="Frameworks" mix={[listStyle, listboxKeys()]}>
 *     {frameworks.map((option) => (
 *       <div key={option.value} mix={[optionStyle, listbox.option(option)]}>{option.label}</div>
 *     ))}
 *   </div>
 * </listbox.Context>
 */
export const listboxKeys: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let context = handle.context.get(listbox.Context);
	let getHostNode = trackHostNode(handle);
	let lastValue = context.value;
	let lastActiveValue = context.activeValue;

	return () => {
		let value = context.value;
		let activeValue = context.activeValue;

		if (value !== lastValue || activeValue !== lastActiveValue) {
			lastValue = value;
			lastActiveValue = activeValue;
			getHostNode()?.dispatchEvent(new ListboxChangeEvent({ value, activeValue }));
		}

		return listbox.list();
	};
});
