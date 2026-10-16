/**
 * The combobox keyboard pattern over options a server rendered: arrows choose a row of the
 * listbox the host's `aria-controls` names while focus stays in the host, and Enter follows
 * it. Without JS every option is still a link a reader can tab to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Every option of the listbox `combobox` controls, in document order. */
function optionsOf(combobox: HTMLElement): Array<HTMLElement> {
	let id = combobox.getAttribute("aria-controls");
	let listbox = id ? combobox.ownerDocument.getElementById(id) : null;
	return listbox ? Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')) : [];
}

/**
 * The index of the option `combobox` has chosen, or `-1` while the combobox itself is the
 * choice. The choice lives in `aria-activedescendant`, so it reads the same to every caller.
 *
 * @param combobox The element carrying `aria-controls` and `aria-activedescendant`.
 * @returns The chosen option's index among the controlled listbox's options.
 */
export function chosenOption(combobox: HTMLElement): number {
	let active = combobox.getAttribute("aria-activedescendant");
	if (!active) return -1;
	return optionsOf(combobox).findIndex((option) => option.id === active);
}

/**
 * Chooses the option at `index`, or none for `-1`, marking it `aria-selected` and scrolling it
 * into view. Call it after replacing the options, since a new list starts with whatever
 * choice its markup carries.
 *
 * @param combobox The element carrying `aria-controls`.
 * @param index The option to choose, or `-1` to choose none.
 */
export function chooseOption(combobox: HTMLElement, index: number): void {
	let options = optionsOf(combobox);
	let chosen = options[index];
	options.forEach((option) => option.setAttribute("aria-selected", String(option === chosen)));
	if (chosen?.id) combobox.setAttribute("aria-activedescendant", chosen.id);
	else combobox.removeAttribute("aria-activedescendant");
	chosen?.scrollIntoView?.({ block: "nearest" });
}

/** Activates an option as a click would: its link when it holds one, else the option itself. */
function follow(option: HTMLElement): void {
	(option.querySelector<HTMLElement>("a[href]") ?? option).click();
}

/**
 * Moves the choice through the controlled options: Down from the host to the first and around
 * from the last, Up back toward the host. Enter follows the chosen option, or the only option
 * when none is chosen and the listbox sits in no `aria-busy` region, so stale rows never open.
 *
 * @example <input role="combobox" aria-controls="search-options" mix={[activeDescendantKeys()]} />
 */
export const activeDescendantKeys: MixinFactory<HTMLElement> = createMixin<HTMLElement>(
	(handle) => {
		handle.addEventListener("insert", (event) => {
			let host = event.node;
			host.addEventListener(
				"keydown",
				(keyEvent) => {
					if (keyEvent.defaultPrevented || keyEvent.isComposing) return;
					let options = optionsOf(host);
					let chosen = chosenOption(host);

					if (keyEvent.key === "ArrowDown" && options.length > 0) {
						keyEvent.preventDefault();
						chooseOption(host, chosen + 1 >= options.length ? 0 : chosen + 1);
					} else if (keyEvent.key === "ArrowUp" && chosen >= 0) {
						keyEvent.preventDefault();
						chooseOption(host, chosen - 1);
					} else if (keyEvent.key === "Enter" && options[chosen]) {
						keyEvent.preventDefault();
						follow(options[chosen]);
					} else if (
						keyEvent.key === "Enter" &&
						options.length === 1 &&
						options[0] &&
						!options[0].closest('[aria-busy="true"]')
					) {
						keyEvent.preventDefault();
						follow(options[0]);
					}
				},
				{ signal: handle.signal },
			);
		});

		return () => {};
	},
);
