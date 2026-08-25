/**
 * Adapts `remix/ui/combobox`'s input behavior onto a ComboBox's text input:
 * narrows the popup's options to the typed text, moves the active option
 * with arrow keys, and commits or clears the draft on blur and `Escape`,
 * mirroring the result as `aria-activedescendant` and `aria-expanded`.
 * Without JS the input renders as a plain text field beside every option,
 * so all options stay tabbable and readable by assistive technology.
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
 * filter text, active option, or open state moves, letting a consumer
 * react to live narrowing without reading `remix/ui/combobox`'s context.
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
 * option list by delegating typing, arrow-key movement, and blur/`Escape`
 * commit to `remix/ui/combobox`'s `input()` primitive.
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
