/**
 * Wires a composer's formatting row: a click on a `[data-format]` button, or that action's
 * shortcut while the field has focus, rewrites the field's selection as Markdown. Why JS:
 * editing the selection and the shortcuts need script. No-JS baseline: the row is hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import type { FormatAction } from "../utils/markdown-format.js";

import { matchesKeyCombo } from "../../utils/key-combo.js";
import { findComposerInput, rewriteText } from "../utils/composer-text.js";
import { applyFormat } from "../utils/markdown-format.js";

/** The attribute naming the action each button of the row applies. */
export const FORMAT_ACTION_ATTRIBUTE = "data-format";

/** The combo bound to each action that has one while the field has focus. */
export const FORMAT_SHORTCUTS: Partial<Record<FormatAction, string>> = {
	bold: "mod+b",
	italic: "mod+i",
	strike: "mod+shift+x",
	code: "mod+e",
};

/** Options for {@link composerFormat}. */
export interface ComposerFormatOptions {
	/** The actions the row offers, whose shortcuts it binds. */
	actions: readonly FormatAction[];
	/** The `id` of the `<textarea>` to edit; the host form's `Composer.Input` when omitted. */
	target?: string;
}

/**
 * Put on the element around a composer's formatting buttons. Each button keeps the field's
 * focus and selection when pressed, and every edit lands on the browser's undo history.
 *
 * @example <span mix={[composerFormat({ actions: ["bold", "italic"] })]}><button data-format="bold">…</button></span>
 */
export const composerFormat: MixinFactory<HTMLElement, [options: ComposerFormatOptions]> =
	createMixin<HTMLElement, [options: ComposerFormatOptions]>((handle) => {
		let options: ComposerFormatOptions | undefined;
		let host: HTMLElement | undefined;

		/** The field the row edits, looked up on each use so a changed `target` is honored. */
		function field(): HTMLTextAreaElement | null {
			return host === undefined ? null : findComposerInput(host, options?.target);
		}

		/** Applies `action` to the field's selection. */
		function format(action: FormatAction) {
			let input = field();
			if (input === null) return;
			let next = applyFormat(input.value, input.selectionStart, input.selectionEnd, action);
			rewriteText(input, next.value, next.start, next.end);
		}

		/** The action of the button an event landed in, if any. */
		function actionOf(event: Event): FormatAction | undefined {
			if (!(event.target instanceof Element)) return undefined;
			let button = event.target.closest(`[${FORMAT_ACTION_ATTRIBUTE}]`);
			let action = button?.getAttribute(FORMAT_ACTION_ATTRIBUTE);
			return options?.actions.find((candidate) => candidate === action);
		}

		handle.addEventListener("insert", ({ node }) => {
			let signal = handle.signal;
			host = node;
			node.addEventListener(
				"pointerdown",
				(event) => {
					if (actionOf(event) !== undefined) event.preventDefault();
				},
				{ signal },
			);
			node.addEventListener(
				"click",
				(event) => {
					let action = actionOf(event);
					if (action !== undefined) format(action);
				},
				{ signal },
			);
			node.ownerDocument.addEventListener(
				"keydown",
				(event) => {
					if (event.defaultPrevented || event.isComposing || event.target !== field()) return;
					for (let action of options?.actions ?? []) {
						let combo = FORMAT_SHORTCUTS[action];
						if (combo === undefined || !matchesKeyCombo(event, combo)) continue;
						event.preventDefault();
						format(action);
						return;
					}
				},
				{ signal },
			);
		});

		return (next) => {
			options = next;
			return handle.element;
		};
	});
