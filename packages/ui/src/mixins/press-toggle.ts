/**
 * Why JS: flipping `aria-pressed` the instant a ToggleButton is clicked
 * needs a script to write the attribute back onto the host — the platform
 * has no declarative way to toggle an ARIA state attribute on its own.
 * No-JS baseline: the button still submits its enclosing form, so a server
 * round-trip persists the flipped state and re-renders the button with
 * `aria-pressed` already updated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { DISABLED_SELECTOR } from "../utils/disabled-selector";

/**
 * Attribute {@link pressToggle} reads and flips on every click — the same
 * attribute a ToggleButton's own styling keys off, so no separate state
 * needs to be kept in sync with it.
 */
const PRESSED_ATTRIBUTE = "aria-pressed";

/** DOM event type dispatched by {@link pressToggle} whenever a click flips the host's pressed state. */
const PRESS_TOGGLE_CHANGE_EVENT = "ui:press-toggle-change" as const;

declare global {
	interface HTMLElementEventMap {
		[PRESS_TOGGLE_CHANGE_EVENT]: PressToggleChangeEvent;
	}
}

/**
 * Dispatched on a ToggleButton by {@link pressToggle} right after a click
 * flips its `aria-pressed` attribute, carrying the value so a consumer can
 * persist it or mirror it onto another element without reading it back.
 */
export class PressToggleChangeEvent extends Event {
	/** The host's `aria-pressed` value immediately after this click. */
	readonly pressed: boolean;

	/**
	 * @param pressed Pressed state the host's `aria-pressed` attribute now holds.
	 */
	constructor(pressed: boolean) {
		super(PRESS_TOGGLE_CHANGE_EVENT, { bubbles: true });
		this.pressed = pressed;
	}
}

/**
 * Flips a ToggleButton's `aria-pressed` attribute on every click and
 * dispatches {@link PressToggleChangeEvent}, keeping the attribute already
 * rendered onto the host as the single source of truth for pressed state.
 *
 * @returns A mixin descriptor for a ToggleButton's `mix` prop.
 * @example
 * <button aria-pressed="false" mix={pressToggle()}>Mute</button>
 */
export const pressToggle: MixinFactory<HTMLButtonElement> = createMixin<HTMLButtonElement>(
	(handle) => {
		return () =>
			createElement(handle.element, {
				mix: [
					on<HTMLButtonElement, "click">("click", (event) => {
						let host = event.currentTarget;
						if (host.matches(DISABLED_SELECTOR)) return;

						event.preventDefault();

						let pressed = host.getAttribute(PRESSED_ATTRIBUTE) !== "true";
						host.setAttribute(PRESSED_ATTRIBUTE, String(pressed));
						host.dispatchEvent(new PressToggleChangeEvent(pressed));
					}),
				],
			});
	},
);
