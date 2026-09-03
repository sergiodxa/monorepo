/**
 * Why JS: remembering a Sidebar's collapsed state across a full page
 * navigation means writing it somewhere the next server render can read
 * back before any markup reaches the browser, and answering a `--ui-toggle`
 * command dispatched from a trigger button elsewhere on the page — neither
 * has an HTML or CSS equivalent.
 * No-JS baseline: the collapse checkbox beneath the Sidebar root still
 * drives the collapse purely through CSS via its own `<label>`; only
 * cross-navigation memory is unavailable without this mixin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { asCommandEvent } from "../utils/command-event.js";
import { writeCookie } from "../utils/write-cookie.js";

/** Invoker command {@link persist} answers on the Sidebar root: flips the collapse checkbox and mirrors its new state into the cookie. */
const TOGGLE_COMMAND = "--ui-toggle";

/**
 * Attribute the Sidebar's collapse checkbox carries. {@link persist} reads
 * and flips this single descendant of its host, the same element the
 * Sidebar's own styles key their `:checked` selector off.
 */
export const SIDEBAR_TOGGLE_ATTRIBUTE = "data-sidebar-toggle";

/**
 * Finds the collapse checkbox beneath `host` — the single descendant
 * carrying {@link SIDEBAR_TOGGLE_ATTRIBUTE} — or `null` when the host renders
 * without one, which leaves {@link persist} with nothing to read or flip.
 *
 * @param host Sidebar root the checkbox is searched beneath.
 */
function findToggleCheckbox(host: HTMLElement): HTMLInputElement | null {
	return host.querySelector<HTMLInputElement>(`[${SIDEBAR_TOGGLE_ATTRIBUTE}]`);
}

/**
 * Mirrors a Sidebar's collapsed state into a cookie, so a fresh page load
 * renders it already collapsed or expanded, and answers the `--ui-toggle`
 * command so a trigger button anywhere on the page can flip the Sidebar.
 *
 * @param key Cookie name the collapsed state persists under — scope it per
 * Sidebar instance on a page that renders more than one.
 * @returns A mixin descriptor for the Sidebar root's `mix` prop.
 * @example
 * <div id="app-sidebar" mix={[persist("app-sidebar:collapsed")]}>
 *   <input type="checkbox" data-sidebar-toggle hidden />
 *   ...
 * </div>
 * <button commandfor="app-sidebar" command="--ui-toggle">Toggle sidebar</button>
 */
export const persist: MixinFactory<HTMLElement, [key: string], ElementProps> = createMixin<
	HTMLElement,
	[key: string],
	ElementProps
>((handle) => {
	return (key) =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "command">("command", (event) => {
					let commandEvent = asCommandEvent(event);
					if (commandEvent.command !== TOGGLE_COMMAND) return;

					let host = event.currentTarget;
					let checkbox = findToggleCheckbox(host);
					if (checkbox === null) {
						if (import.meta.env.DEV) {
							console.warn(
								`persist(): no element with ${SIDEBAR_TOGGLE_ATTRIBUTE} found beneath the Sidebar root to toggle.`,
							);
						}
						return;
					}

					checkbox.checked = !checkbox.checked;
					writeCookie(key, checkbox.checked);
				}),
				on<HTMLElement, "change">("change", (event) => {
					let target = event.target;
					if (!(target instanceof HTMLInputElement)) return;
					if (!target.hasAttribute(SIDEBAR_TOGGLE_ATTRIBUTE)) return;

					writeCookie(key, target.checked);
				}),
			],
		});
});
