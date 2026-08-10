/**
 * Wires a SearchField's clear button to empty its associated input alone,
 * leaving every other field in the surrounding form untouched, and reveals
 * the button itself the moment it mounts.
 *
 * Why JS: a button inside a `<form>` either submits it or, declared
 * `type="reset"`, empties every field the form holds — neither gives a
 * single input its own dedicated clear action, and no built-in browser
 * command does either, so a script has to supply both the wiring and the
 * one field it targets. The button ships `hidden` in markup for exactly
 * that reason: until a script backs it, it has nothing useful to do.
 * No-JS baseline: the button stays hidden, leaving the field's own native
 * `type="search"` cancel affordance — rendered by WebKit-based browsers —
 * as the only dedicated way to clear it; in every browser the text can
 * still be selected and deleted by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { DISABLED_SELECTOR } from "../utils/disabled-selector";

/**
 * Custom Invoker Command a SearchField's clear button declares
 * (`command={SEARCH_FIELD_CLEAR_COMMAND}`, `commandfor` pointing at the
 * field's input) so the pairing reads as a real invoker relationship in
 * markup, even though {@link clearField} itself reacts to the button's
 * click rather than to the command bubbling off the input.
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
 * a consumer can react to the clear — cancel an in-flight request for that
 * term, drop a query param — without having captured the value itself
 * ahead of the press.
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
 * Wires a SearchField's clear button to empty its associated input alone,
 * instead of the whole-form reset a plain `type="reset"` button would
 * trigger. Reveals the button — shipped `hidden` in markup so a page this
 * mixin never reaches still renders without an inert control — the moment
 * it mounts, then resolves the field to clear from the button's own
 * `commandfor` reference on every press, rather than assuming a fixed
 * position among siblings.
 *
 * A press writes an empty string into the resolved input, dispatches the
 * `input` and `change` events that setting `.value` directly doesn't raise
 * on its own — so any filtering or validation listening for those reacts
 * exactly as it would to the user deleting the text themselves — then
 * dispatches {@link SearchFieldClearEvent} on the input and returns focus to
 * it, since the button can itself vanish the instant the surrounding styles
 * react to the now-empty field. A disabled button, or one whose target is
 * disabled, read-only, or already empty, ignores the press.
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
