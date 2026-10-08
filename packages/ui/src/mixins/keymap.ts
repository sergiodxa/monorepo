/**
 * Why JS: a page-wide shortcut answers a key pressed anywhere in the document, and HTML
 * has no declarative wiring from a keystroke to an action.
 * No-JS baseline: every action stays reachable through the controls it presses, by `Tab`
 * and the pointer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import type { KeyCombo } from "../utils/key-combo.js";

import { isTypingTarget, matchesKeyCombo, parseKeyCombo } from "../utils/key-combo.js";

/**
 * Types for {@link keymap} and {@link bindKeymap}.
 */
export namespace Keymap {
	/**
	 * Each combo, as {@link parseKeyCombo} reads it, mapped to what pressing it runs. The
	 * first entry a keystroke matches runs, and the keystroke is then default-prevented.
	 */
	export interface Bindings {
		[combo: string]: (event: KeyboardEvent) => void;
	}

	/** Options for {@link bindKeymap}. */
	export interface Options {
		/** Takes the bindings off the document. */
		signal: AbortSignal;
		/**
		 * The element the bindings belong to. A keystroke inside a `<dialog>` stands the
		 * bindings down unless that dialog sits inside this element, so a modal layered over
		 * the page keeps its keys while the keymap's own help panel still answers them.
		 */
		scope?: Element | null;
	}
}

/**
 * Whether a keystroke belongs to someone else: handled nearer its target already, part
 * of an IME composition, typed into a field, or pressed inside a dialog outside `scope`.
 *
 * @param event The keystroke as it reached the document.
 * @param scope The element whose own dialogs still answer the bindings.
 * @returns Whether the bindings stand down for this keystroke.
 */
export function isClaimedKeystroke(event: KeyboardEvent, scope?: Element | null): boolean {
	if (event.defaultPrevented || event.isComposing) return true;
	if (isTypingTarget(event.target)) return true;

	let target = event.target;
	if (typeof Element === "undefined" || !(target instanceof Element)) return false;

	let dialog = target.closest("dialog");
	if (dialog === null) return false;

	return !(scope?.contains(dialog) ?? false);
}

/** A combo already parsed, paired with what pressing it runs. */
type CompiledBinding = [combo: KeyCombo, run: (event: KeyboardEvent) => void];

/** Parses every combo once, keeping the binding order a keystroke is matched in. */
function compile(bindings: Keymap.Bindings): CompiledBinding[] {
	return Object.entries(bindings).map(([combo, run]) => [parseKeyCombo(combo), run]);
}

/**
 * Runs the first binding a keystroke matches, reading the bindings at keystroke time so
 * a caller that swaps its map keeps one listener.
 */
function listen(
	document: Document,
	bindings: () => readonly CompiledBinding[],
	options: Keymap.Options,
): void {
	document.addEventListener(
		"keydown",
		(event) => {
			if (isClaimedKeystroke(event, options.scope)) return;

			let match = bindings().find(([combo]) => matchesKeyCombo(event, combo));
			if (match === undefined) return;

			match[1](event);
			event.preventDefault();
		},
		{ signal: options.signal },
	);
}

/**
 * Listens for `bindings` on `document` in the bubble phase, so a handler nearer the
 * target that claims the keystroke first keeps it.
 *
 * @param document The document to listen on.
 * @param bindings Combos mapped to what each runs.
 * @param options The signal that removes the listener, and the bindings' own scope.
 * @example bindKeymap(document, { j: next, k: previous, "?": openHelp }, { signal });
 */
export function bindKeymap(
	document: Document,
	bindings: Keymap.Bindings,
	options: Keymap.Options,
): void {
	let compiled = compile(bindings);
	listen(document, () => compiled, options);
}

/**
 * Binds a map of page-wide shortcuts for as long as the host stays mounted, with the host
 * as the bindings' scope: a dialog inside it answers them, any other dialog and any field
 * being typed in keeps its keys. The latest map passed is the one a keystroke runs.
 *
 * @param bindings Combos mapped to what each runs.
 * @example <div mix={[keymap({ j: next, k: previous, "?": openHelp })]}>…</div>
 */
export const keymap: MixinFactory<HTMLElement, [bindings: Keymap.Bindings]> = createMixin<
	HTMLElement,
	[bindings: Keymap.Bindings]
>((handle) => {
	let compiled: CompiledBinding[] = [];

	/**
	 * The listener goes on the document the host was inserted into, which leaves the mixin
	 * inert wherever the host renders without one, such as on a server.
	 */
	handle.addEventListener("insert", (event) => {
		listen(event.node.ownerDocument, () => compiled, {
			signal: handle.signal,
			scope: event.node,
		});
	});

	return (bindings) => {
		compiled = compile(bindings);
	};
});
