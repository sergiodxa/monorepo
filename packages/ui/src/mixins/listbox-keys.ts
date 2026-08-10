/**
 * Adapts `remix/ui/listbox`'s ARIA listbox keyboard pattern onto a ListBox's
 * option-list host: arrow keys, `Home`/`End`, typeahead, and `Enter`/`Space`
 * move and commit the shared context's active option, by delegating to
 * `remix/ui/listbox`'s own `list()` primitive instead of re-deriving that
 * behavior. Reports the context's selected value and active option as a
 * typed DOM event so a consumer can react without reading that context
 * directly.
 *
 * Why JS: the WAI-ARIA listbox pattern moves a single active-option cursor
 * with the arrow keys, `Home`, `End`, and typeahead, then commits it as the
 * selection with `Enter`, `Space`, or a click — a keyboard model no native
 * list expresses on its own.
 * No-JS baseline: options still render as a labeled set of native,
 * individually focusable controls, so every option stays reachable and
 * selectable through ordinary `Tab` order and native form submission; only
 * the unified arrow-key cursor and typed search are unavailable.
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
 * Dispatched on a ListBox's option-list host by {@link listboxKeys} whenever
 * `remix/ui/listbox`'s shared context moves its selected value or its
 * keyboard/pointer-active option, so a consumer can react — a live-region
 * announcement, syncing a hidden field's value — without reading that
 * context directly.
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
 * for its options, by delegating arrow-key movement, `Home`/`End`,
 * typeahead, and `Enter`/`Space` activation to `remix/ui/listbox`'s own
 * `list()` primitive rather than re-deriving that behavior.
 *
 * Apply it inside an ancestor `listbox.Context` (from `remix/ui/listbox`)
 * alongside a matching `option()` mixin on every option — `listboxKeys()`
 * only wires the option-list side of that shared context.
 *
 * Dispatches {@link ListboxChangeEvent} on the option-list host whenever the
 * selected value or the active option moves.
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
