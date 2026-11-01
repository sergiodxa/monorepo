/**
 * Why JS: a button cannot disable itself until a field matches a phrase, so script keeps
 * a type-to-confirm dialog's confirming control disabled until the text matches exactly.
 * No-JS baseline: the field's `pattern` and `required` make the browser refuse a mismatch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Attribute marking a dialog's confirming control, which {@link confirmPhrase} enables on a match. */
export const CONFIRM_ACTION_ATTRIBUTE = "data-confirm-action";

/**
 * Applied to a type-to-confirm field: enables the enclosing dialog's
 * `[data-confirm-action]` control exactly while the field holds `phrase`, and clears the
 * field when the dialog closes so every opening starts locked.
 *
 * @example <Input pattern={escaped} required mix={[confirmPhrase("acme-ops")]} />
 */
export const confirmPhrase: MixinFactory<HTMLInputElement, [phrase: string]> = createMixin<
	HTMLInputElement,
	[phrase: string]
>((handle) => {
	let phrase = "";
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		connect(event.node, () => phrase, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});

	return (next) => {
		phrase = next;
	};
});

/**
 * Locks `input`'s dialog until `signal` aborts.
 *
 * @param input The phrase field.
 * @param phrase Reads the phrase to match, which may change between renders.
 * @param signal Ends every listener once the field leaves the document.
 */
function connect(input: HTMLInputElement, phrase: () => string, signal: AbortSignal): void {
	let dialog = input.closest("dialog");
	let action = dialog?.querySelector<HTMLButtonElement>(`[${CONFIRM_ACTION_ATTRIBUTE}]`);

	/** Enables the confirming control exactly while the field holds the phrase. */
	let sync = () => {
		if (action) action.disabled = input.value !== phrase();
	};

	input.addEventListener("input", sync, { signal });
	dialog?.addEventListener(
		"close",
		() => {
			input.value = "";
			sync();
		},
		{ signal },
	);
	sync();
}
