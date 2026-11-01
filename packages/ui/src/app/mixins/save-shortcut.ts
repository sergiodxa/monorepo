/**
 * Why JS: a page has no key binding for submitting a form, so script binds ⌘S/Ctrl+S to the
 * form a person is editing, in place of the browser's own save-page dialog.
 * No-JS baseline: every form keeps its Save button, and ⌘S saves the page as the browser does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { shortcutRegistry } from "../behaviors/shortcuts.js";

/** The keys that save, as the shortcut registry spells them. */
export const SAVE_SHORTCUT = "mod+s";

/** Every form bound to ⌘S on each document, for choosing the one a keystroke saves. */
const BINDINGS = new WeakMap<Document, Set<SaveShortcuts.Binding>>();

/** Types for {@link saveShortcut} and {@link bindSaveShortcut}. */
export namespace SaveShortcuts {
	/** Configuration for {@link saveShortcut}. */
	export interface Options {
		/** The `id` of the form ⌘S submits; omit to submit the form the host sits in. */
		form?: string;
	}

	/** One form's answer to ⌘S. */
	export interface Binding {
		form: HTMLFormElement;
		/** Saves the form once ⌘S chose it. */
		save(): void;
		/**
		 * Yields to every other binding of the same form, so a save bar steps aside for the
		 * form's own primary save and one keystroke submits once.
		 */
		fallback?: boolean;
	}
}

/**
 * Applied to any element in or beside a form: ⌘S (Ctrl+S elsewhere) submits that form through
 * `requestSubmit`, while typing included. With several bound forms on a page, the one holding
 * focus saves; with focus outside them all, the only bound form saves.
 *
 * @example <span hidden mix={[saveShortcut({ form: "post-form" })]} />
 */
export const saveShortcut: MixinFactory<HTMLElement, [options?: SaveShortcuts.Options]> =
	createMixin<HTMLElement, [options?: SaveShortcuts.Options]>((handle) => {
		let options: SaveShortcuts.Options | undefined;
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			let node = event.node;
			let form = options?.form
				? node.ownerDocument.getElementById(options.form)
				: node.closest("form");
			if (!(form instanceof HTMLFormElement)) return;
			bindSaveShortcut({ form, save: () => form.requestSubmit() }, controller.signal);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (next) => {
			options = next;
		};
	});

/**
 * Binds ⌘S to `binding.form` until `signal` aborts, through the page's shortcut registry. Every
 * binding on the page agrees on one form per keystroke, so exactly one saves; a keystroke that
 * chooses none is still held back from the browser's save-page dialog.
 *
 * @param binding The form and how it saves.
 * @param signal Removes the binding.
 */
export function bindSaveShortcut(binding: SaveShortcuts.Binding, signal: AbortSignal): void {
	let doc = binding.form.ownerDocument;
	let bindings = BINDINGS.get(doc) ?? new Set();
	BINDINGS.set(doc, bindings);
	bindings.add(binding);
	signal.addEventListener("abort", () => bindings.delete(binding), { once: true });

	shortcutRegistry(doc).register({
		keys: SAVE_SHORTCUT,
		whileTyping: true,
		scope: binding.form,
		signal,
		run: () => {
			let chosen = chosenForm(doc, bindings);
			if (chosen === null) return true;
			if (chosen !== binding.form) return false;
			if (binding.fallback && hasPrimary(bindings, binding.form)) return false;
			binding.save();
			return true;
		},
	});
}

/**
 * The form a ⌘S saves: the bound form holding focus, or with focus in no form, the only bound
 * form on the page. Focus in a form nothing bound chooses none.
 */
function chosenForm(doc: Document, bindings: Set<SaveShortcuts.Binding>): HTMLFormElement | null {
	let forms = [
		...new Set([...bindings].map((binding) => binding.form).filter((form) => form.isConnected)),
	];
	let focused = formOf(doc.activeElement);
	if (focused !== null) return forms.includes(focused) ? focused : null;
	return forms.length === 1 ? forms[0]! : null;
}

/** The form `element` submits with: its `form` owner, or the form it sits in. */
function formOf(element: Element | null): HTMLFormElement | null {
	if (element === null) return null;
	let owner = (element as Partial<HTMLInputElement>).form;
	if (owner instanceof HTMLFormElement) return owner;
	return element.closest("form");
}

/** Whether `form` has a binding that saves it outright, which a fallback binding yields to. */
function hasPrimary(bindings: Set<SaveShortcuts.Binding>, form: HTMLFormElement): boolean {
	return [...bindings].some((binding) => binding.form === form && !binding.fallback);
}
