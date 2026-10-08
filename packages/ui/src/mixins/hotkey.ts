/**
 * Global keyboard-shortcut mixin for a Command dialog or any dialog/popover
 * host: opens the host when a key combination strikes anywhere in the
 * document, and closes it again on the same combination while it's already
 * open, adapting to whichever native open API the host exposes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import type { KeyCombo } from "../utils/key-combo.js";

import { matchesKeyCombo, parseKeyCombo } from "../utils/key-combo.js";

import { trackHostNode } from "./track-host-node.js";

/**
 * Reads `host`'s current native open state: `HTMLDialogElement.open` for a
 * `<dialog>`, or the `:popover-open` pseudo-class for anything else.
 *
 * @param host Element {@link hotkey} is mixed onto.
 * @returns Whether `host` is currently showing.
 */
function isOpen(host: HTMLElement): boolean {
	if (host instanceof HTMLDialogElement) return host.open;
	return host.matches(":popover-open");
}

/**
 * Drives `host` to `open`, through whichever native API applies —
 * `showModal()`/`close()` for a `<dialog>`, `showPopover()`/`hidePopover()`
 * for an element carrying the `popover` attribute.
 *
 * @param host Element {@link hotkey} is mixed onto.
 * @param open Target open state.
 */
function setOpen(host: HTMLElement, open: boolean): void {
	if (host instanceof HTMLDialogElement) {
		if (open) host.showModal();
		else host.close();
		return;
	}

	if (!host.hasAttribute("popover")) {
		if (import.meta.env.DEV) {
			console.warn(
				`hotkey(): host is neither a <dialog> nor a [popover] element, so it cannot be ${open ? "shown" : "hidden"}.`,
			);
		}
		return;
	}

	if (open) host.showPopover();
	else host.hidePopover();
}

/**
 * Opens the host when `combo` is struck anywhere in the document while it's
 * closed, and closes it again on the same combo while it's already open,
 * driving the host's own native `<dialog>` or `[popover]` open state.
 *
 * @param combo Key combination that opens or closes the host, e.g. `"mod+k"`, where `mod`
 * is Command on Apple keyboards and Control elsewhere.
 * @example
 * <dialog id="command-palette" mix={[hotkey("mod+k")]}>
 * 	<Command>...</Command>
 * </dialog>
 * @example
 * <div id="quick-switcher" popover="manual" mix={[hotkey("mod+shift+k")]}>
 * 	...
 * </div>
 */
export const hotkey: MixinFactory<HTMLElement, [combo: string]> = createMixin<
	HTMLElement,
	[combo: string]
>((handle) => {
	let getHostNode = trackHostNode(handle);
	let parsed: KeyCombo | undefined;

	/**
	 * A combination is watched on the document the host was inserted into, which is what
	 * keeps the mixin to the one document it belongs to and leaves it inert wherever the
	 * host is rendered without one, such as on a server.
	 */
	handle.addEventListener("insert", (event) => {
		event.node.ownerDocument.addEventListener(
			"keydown",
			(keyEvent) => {
				let hostNode = getHostNode();
				if (hostNode === undefined || parsed === undefined) return;
				if (keyEvent.repeat || !matchesKeyCombo(keyEvent, parsed)) return;

				keyEvent.preventDefault();
				setOpen(hostNode, !isOpen(hostNode));
			},
			{ signal: handle.signal },
		);
	});

	return (combo) => {
		parsed = parseKeyCombo(combo);

		if (parsed.key === "" && import.meta.env.DEV) {
			console.warn(`hotkey(): "${combo}" has no trigger key and will never match.`);
		}
	};
});
