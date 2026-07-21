/**
 * Adapts `remix/ui/combobox`'s input behavior onto a ComboBox's text input:
 * narrows the popup's option list to whatever has been typed, moves the
 * active option with the arrow keys, and commits or clears the draft on
 * blur and `Escape`, mirroring the result back as `aria-activedescendant`
 * and `aria-expanded` on the input.
 *
 * Why JS: the WAI-ARIA combobox pattern narrows a popup listbox to the text
 * typed so far and moves a single active-option cursor with the arrow keys,
 * `Enter`, and `Escape`, while keeping `aria-expanded`, `aria-controls`, and
 * `aria-activedescendant` in sync — none of which a plain text input or a
 * native list expresses on its own.
 * No-JS baseline: the input renders as an ordinary text field alongside
 * every option, so every option stays in the tab order and readable by
 * assistive technology; only the typed narrowing and the arrow-key cursor
 * are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createMixin } from "remix/ui";
import * as combobox from "remix/ui/combobox/primitives";

/** DOM event type dispatched by {@link comboboxFilter} whenever the draft filter or the active option changes. */
const FILTER_CHANGE_EVENT = "ui:combobox-filter-change" as const;

declare global {
	interface HTMLElementEventMap {
		[FILTER_CHANGE_EVENT]: ComboboxFilterChangeEvent;
	}
}

/**
 * Dispatched on a ComboBox's input by {@link comboboxFilter} whenever the
 * draft filter text, the active option, or the popup's open state moves, so
 * a consumer can react to live, as-you-type narrowing — an empty-results
 * message, a live-region announcement of the match count — without reading
 * `remix/ui/combobox`'s own context directly.
 */
export class ComboboxFilterChangeEvent extends Event {
	/** Id of the option `Enter` would commit right now, or `null` when none is active. */
	readonly activeOptionId: string | null;
	/** Draft text the popup's options are currently narrowed by. */
	readonly filterText: string;
	/** `true` while the popup is open and showing the narrowed option list. */
	readonly isOpen: boolean;

	/**
	 * @param init Snapshot of the combobox's filter state at dispatch time.
	 */
	constructor(init: { activeOptionId: string | null; filterText: string; isOpen: boolean }) {
		super(FILTER_CHANGE_EVENT, { bubbles: true });
		this.activeOptionId = init.activeOptionId;
		this.filterText = init.filterText;
		this.isOpen = init.isOpen;
	}
}

/**
 * Turns a ComboBox's text input into the as-you-type filter for its popup
 * option list, by delegating typing, arrow-key movement, and blur/`Escape`
 * commit semantics to `remix/ui/combobox`'s own `input()` primitive rather
 * than re-deriving that behavior. Every sibling option that also carries
 * `remix/ui/combobox`'s `option()` primitive reacts to the same shared
 * filter state automatically, hiding itself when it no longer matches and
 * exposing its match through the `hidden` attribute the option's own
 * styling already keys off.
 *
 * Apply it inside an ancestor `combobox.Context` (from
 * `remix/ui/combobox/primitives`) alongside a matching `option()` mixin on
 * every option — `comboboxFilter()` only wires the input side of that
 * shared context.
 *
 * Dispatches {@link ComboboxFilterChangeEvent} on the input whenever the
 * draft filter text, the active option, or the popup's open state moves.
 *
 * @example
 * <combobox.Context name="airport">
 *   <input mix={[inputStyle, comboboxFilter()]} placeholder="Search airports" />
 *   <div mix={[popoverStyle, combobox.popover()]}>
 *     <div mix={[listStyle, combobox.list()]}>
 *       {airports.map((airport) => (
 *         <div key={airport.value} mix={[optionStyle, combobox.option(airport)]}>{airport.label}</div>
 *       ))}
 *     </div>
 *   </div>
 * </combobox.Context>
 */
export const comboboxFilter: MixinFactory<HTMLInputElement> = createMixin<HTMLInputElement>(
	(handle) => {
		let context = handle.context.get(combobox.Context);
		let hostNode: HTMLInputElement | undefined;
		let lastFilterText = context.filterText;
		let lastActiveOptionId = context.activeId ?? null;
		let lastIsOpen = context.isOpen;

		handle.addEventListener("insert", (event) => {
			hostNode = event.node;
		});
		handle.addEventListener("remove", () => {
			hostNode = undefined;
		});

		return () => {
			let filterText = context.filterText;
			let activeOptionId = context.activeId ?? null;
			let isOpen = context.isOpen;

			if (
				filterText !== lastFilterText ||
				activeOptionId !== lastActiveOptionId ||
				isOpen !== lastIsOpen
			) {
				lastFilterText = filterText;
				lastActiveOptionId = activeOptionId;
				lastIsOpen = isOpen;

				hostNode?.dispatchEvent(
					new ComboboxFilterChangeEvent({ activeOptionId, filterText, isOpen }),
				);
			}

			return combobox.input();
		};
	},
);
