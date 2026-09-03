/**
 * Wires a SearchField's clear button to empty its associated input alone
 * and reveals the button, shipped `hidden` in markup, the moment it mounts.
 * Script is required since a form button can only submit or reset every
 * field, and no built-in browser command clears a single input on its own —
 * WebKit's native `type="search"` cancel affordance is the only fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { DISABLED_SELECTOR } from "../utils/disabled-selector.js";

/**
 * Custom Invoker Command a SearchField's clear button declares
 * (`command={SEARCH_FIELD_CLEAR_COMMAND}`, `commandfor` pointing at the
 * field's input) so the pairing reads as a real invoker relationship in markup, matched by {@link clearField} through the button's own click.
 */
export const SEARCH_FIELD_CLEAR_COMMAND = "--clear" as const;

/** DOM event type dispatched on a SearchField's input by {@link clearField} right after it empties the field. */
const SEARCH_FIELD_CLEAR_EVENT = "ui:search-field-clear" as const;

declare global {
	interface HTMLElementEventMap {
		[SEARCH_FIELD_CLEAR_EVENT]: SearchFieldClearEvent;
	}
}

/**
 * Dispatched on a SearchField's input by {@link clearField} immediately
 * after its value is emptied, carrying the text it held a moment before so
 * a consumer can react to the clear — canceling an in-flight request for that term, or dropping a query param — using only this event.
 */
export class SearchFieldClearEvent extends Event {
	/** The input's value immediately before this clear. */
	readonly previousValue: string;

	/**
	 * @param previousValue The input's value immediately before this clear.
	 */
	constructor(previousValue: string) {
		super(SEARCH_FIELD_CLEAR_EVENT, { bubbles: true });
		this.previousValue = previousValue;
	}
}

/**
 * Finds the input a clear button's `commandfor` targets, preferring the
 * live `commandForElement` reference and falling back to an `id` lookup for
 * runtimes that parse `commandfor` without yet reflecting the IDL property.
 *
 * @param button The clear button found inside a SearchField.
 */
function resolveClearTarget(button: HTMLButtonElement): HTMLInputElement | undefined {
	if (button.commandForElement instanceof HTMLInputElement) return button.commandForElement;

	let commandForId = button.getAttribute("commandfor");
	if (!commandForId) return undefined;

	let fallbackTarget = document.getElementById(commandForId);
	return fallbackTarget instanceof HTMLInputElement ? fallbackTarget : undefined;
}

/**
 * Wires a SearchField's clear button to empty its own `commandfor`-resolved
 * input and dispatch `input`/`change` plus {@link SearchFieldClearEvent}
 * before refocusing the field, since the button can vanish once styles react to the emptied state; a disabled, read-only, or already-empty target leaves the press with no effect.
 *
 * @returns A mixin descriptor for a SearchField clear button's `mix` prop.
 * @example
 * <div>
 * 	<input id="site-search" type="search" name="q" />
 * 	<button
 * 		type="button"
 * 		hidden
 * 		commandfor="site-search"
 * 		command={SEARCH_FIELD_CLEAR_COMMAND}
 * 		aria-label={t("searchField.clear")}
 * 		mix={clearField()}
 * 	>
 * 		<XIcon />
 * 	</button>
 * </div>
 */
export const clearField: MixinFactory<HTMLButtonElement> = createMixin<HTMLButtonElement>(
	(handle) => {
		handle.addEventListener("insert", (event) => {
			event.node.hidden = false;
		});

		return () =>
			createElement(handle.element, {
				mix: [
					on<HTMLButtonElement, "click">("click", (event) => {
						let button = event.currentTarget;
						if (button.matches(DISABLED_SELECTOR)) return;

						let input = resolveClearTarget(button);
						if (!input) return;
						if (input.disabled || input.readOnly) return;
						if (input.value === "") return;

						let previousValue = input.value;
						input.value = "";
						input.dispatchEvent(new Event("input", { bubbles: true }));
						input.dispatchEvent(new Event("change", { bubbles: true }));
						input.dispatchEvent(new SearchFieldClearEvent(previousValue));
						input.focus();
					}),
				],
			});
	},
);
