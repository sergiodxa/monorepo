/**
 * Global keyboard-shortcut mixin for a Command dialog or any dialog/popover
 * host: listens for a key combination struck anywhere in the document and
 * opens the host if it's currently closed, or closes it again if the same
 * combination strikes while it's already open. Adapts to whichever native
 * API the host exposes — `showModal()`/`close()` for a `<dialog>`,
 * `showPopover()`/`hidePopover()` for a `[popover]` element — so the same
 * mixin pairs with either without the consumer branching on host type.
 *
 * Why JS: a shortcut that opens a host no matter where focus currently sits
 * on the page has no HTML attribute or CSS selector standing in for
 * "recognize this key combination struck anywhere in the document and react
 * to it" — only a document-level `keydown` listener can do that.
 * No-JS baseline: the host still opens through whatever declarative trigger
 * already targets it — a `commandfor`/`command` button for a `<dialog>`, or
 * a `popovertarget` button for a `[popover]` element — the combo is a
 * faster, additional path to that same native open state, never the only
 * one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { addEventListeners, createMixin } from "remix/ui";

import { trackHostNode } from "./track-host-node";

/** Modifier token spellings {@link parseCombo} resolves to the platform's primary modifier, checked as `event.ctrlKey || event.metaKey`. */
const MOD_ALIASES = new Set(["mod", "ctrl", "control", "cmd", "command", "meta"]);

/** Modifier token spellings {@link parseCombo} resolves to `event.altKey`. */
const ALT_ALIASES = new Set(["alt", "option"]);

/** Modifier token spelling {@link parseCombo} resolves to `event.shiftKey`. */
const SHIFT_ALIAS = "shift";

/**
 * A `combo` string, already split into the literal trigger key and the
 * modifiers that must be held alongside it — what {@link matchesCombo}
 * checks a `keydown` event against.
 */
interface ParsedCombo {
	/** Lowercased `KeyboardEvent.key` the combo triggers on. */
	key: string;
	/** Whether the platform's primary modifier (Ctrl or Cmd) must be held. */
	mod: boolean;
	/** Whether Alt (Option on macOS) must be held. */
	alt: boolean;
	/** Whether Shift must be held. */
	shift: boolean;
}

/**
 * Parses a `+`-joined combo string (`"mod+k"`, `"mod+shift+p"`) into the
 * modifier flags and literal trigger key {@link matchesCombo} compares a
 * `keydown` event against. Tokens are matched case-insensitively; `mod`,
 * `ctrl`, `control`, `cmd`, `command`, and `meta` all resolve to the same
 * cross-platform primary-modifier flag, `alt` and `option` are equivalent,
 * and the final token is always the trigger key.
 *
 * @param combo Combo string as passed to {@link hotkey}.
 * @returns The parsed modifier flags and trigger key.
 */
function parseCombo(combo: string): ParsedCombo {
	let tokens = combo
		.split("+")
		.map((token) => token.trim().toLowerCase())
		.filter((token) => token.length > 0);

	let key = tokens.at(-1) ?? "";
	let modifiers = tokens.slice(0, -1);

	if (key === "" && import.meta.env.DEV) {
		console.warn(`hotkey(): "${combo}" has no trigger key and will never match.`);
	}

	return {
		key,
		mod: modifiers.some((token) => MOD_ALIASES.has(token)),
		alt: modifiers.some((token) => ALT_ALIASES.has(token)),
		shift: modifiers.includes(SHIFT_ALIAS),
	};
}

/**
 * Reports whether `event` strikes exactly the key and modifier combination
 * `combo` describes: every modifier `combo` requires must be held, and no
 * modifier it doesn't require may be, so a combo never fires on a superset
 * chord it wasn't written for.
 *
 * @param event `keydown` event observed on the document.
 * @param combo Parsed combo to compare `event` against.
 * @returns Whether `event` is an exact match for `combo`.
 */
function matchesCombo(event: KeyboardEvent, combo: ParsedCombo): boolean {
	if (event.key.toLowerCase() !== combo.key) return false;
	if ((event.ctrlKey || event.metaKey) !== combo.mod) return false;
	if (event.altKey !== combo.alt) return false;
	if (event.shiftKey !== combo.shift) return false;
	return true;
}

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
 * for an element carrying the `popover` attribute — logging a dev-mode
 * warning and doing nothing for a host that's neither, since there's no
 * native open state left to drive.
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
 * closed, and closes it again if `combo` strikes while it's already open.
 * Reads and drives the host's own native open state — `HTMLDialogElement`'s
 * `open` property with `showModal()`/`close()` for a `<dialog>`, the
 * `:popover-open` pseudo-class with `showPopover()`/`hidePopover()` for a
 * `[popover]` element — so it composes with whichever the host already is,
 * without tracking any open state of its own.
 *
 * `combo` is a `+`-joined, case-insensitive list of modifier tokens
 * followed by the trigger key: `mod` (and its spellings `ctrl`, `control`,
 * `cmd`, `command`, `meta`) resolves to the platform's primary modifier,
 * checked as `event.ctrlKey || event.metaKey` so the same combo answers to
 * Ctrl on Windows/Linux and Cmd on macOS; `alt`/`option` checks
 * `event.altKey`; `shift` checks `event.shiftKey`. Every modifier the combo
 * doesn't list must be held up, so `"mod+k"` matches a bare Ctrl/Cmd+K only,
 * never Ctrl/Cmd+Shift+K. A held-down key's repeated `keydown` events are
 * ignored, so the host toggles once per keypress rather than once per
 * repeat tick.
 *
 * @param combo Key combination that opens or closes the host, e.g. `"mod+k"`.
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
	let parsed: ParsedCombo | undefined;

	addEventListeners(document, handle.signal, {
		keydown(event) {
			let hostNode = getHostNode();
			if (hostNode === undefined || parsed === undefined) return;
			if (event.repeat || !matchesCombo(event, parsed)) return;

			event.preventDefault();
			setOpen(hostNode, !isOpen(hostNode));
		},
	});

	return (combo) => {
		parsed = parseCombo(combo);
	};
});
