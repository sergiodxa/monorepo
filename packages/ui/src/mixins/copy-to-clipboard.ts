/**
 * Copies text from an element a Message footer copy button's `commandfor`
 * targets onto the system clipboard. Only script can reach the clipboard
 * API, so the copy action alone depends on script; the button's markup,
 * tab order, and label render normally either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { DISABLED_SELECTOR } from "../utils/disabled-selector.js";

/**
 * Custom Invoker Command a Message footer copy button declares via
 * `command={COPY_COMMAND}` and `commandfor`, giving the pairing a genuine
 * invoker relationship in markup, read by {@link copyToClipboard} on click.
 */
export const COPY_COMMAND = "--copy" as const;

/** DOM event type dispatched on a Message footer copy button by {@link copyToClipboard} once a clipboard write settles. */
const COPY_EVENT = "ui:copy" as const;

declare global {
	interface HTMLElementEventMap {
		[COPY_EVENT]: CopyEvent;
	}
}

/**
 * Dispatched on a Message footer copy button by {@link copyToClipboard} once
 * a clipboard write settles, carrying success and the attempted text so
 * consumers can render their own feedback for either outcome.
 */
export class CopyEvent extends Event {
	/** `true` once the text reached the clipboard, `false` if the write was rejected or the platform API is unavailable. */
	readonly success: boolean;

	/** The text {@link copyToClipboard} attempted to copy. */
	readonly text: string;

	/**
	 * @param success Whether the write reached the clipboard.
	 * @param text The text that was attempted.
	 */
	constructor(success: boolean, text: string) {
		super(COPY_EVENT, { bubbles: true });
		this.success = success;
		this.text = text;
	}
}

/**
 * Finds the element a copy button's `commandfor` targets, preferring the
 * live `commandForElement` reference and falling back to an `id` lookup for
 * runtimes that parse `commandfor` without yet reflecting the IDL property.
 *
 * @param button The copy button found inside a Message footer.
 */
function resolveCopyTarget(button: HTMLButtonElement): Element | undefined {
	if (button.commandForElement) return button.commandForElement;

	let commandForId = button.getAttribute("commandfor");
	if (!commandForId) return undefined;

	return document.getElementById(commandForId) ?? undefined;
}

/**
 * Writes the text content of a Message footer copy button's `commandfor`
 * target onto the system clipboard, resolving the target fresh from the
 * button on every press so it stays correct even as the DOM changes.
 *
 * @returns A mixin descriptor for a Message footer copy button's `mix` prop.
 * @example
 * <div id="reply-1-content">{reply.text}</div>
 * <button
 * 	type="button"
 * 	commandfor="reply-1-content"
 * 	command={COPY_COMMAND}
 * 	aria-label={t("message.copy")}
 * 	mix={[
 * 		copyToClipboard(),
 * 		on("ui:copy", (event) => {
 * 			announce(event.success ? t("message.copied") : t("message.copyFailed"));
 * 		}),
 * 	]}
 * >
 * 	<CopyIcon />
 * </button>
 */
export const copyToClipboard: MixinFactory<HTMLButtonElement> = createMixin<HTMLButtonElement>(
	(handle) => {
		return () =>
			createElement(handle.element, {
				mix: [
					on<HTMLButtonElement, "click">("click", async (event, signal) => {
						let button = event.currentTarget;
						if (button.matches(DISABLED_SELECTOR)) return;

						let target = resolveCopyTarget(button);
						if (!target) {
							if (import.meta.env.DEV) {
								console.warn(
									'copyToClipboard(): button has no "commandfor" target to copy text from.',
								);
							}
							return;
						}

						let text = target.textContent?.trim() ?? "";
						if (text === "") return;

						try {
							await navigator.clipboard.writeText(text);
							if (signal.aborted) return;
							button.dispatchEvent(new CopyEvent(true, text));
						} catch {
							if (signal.aborted) return;
							button.dispatchEvent(new CopyEvent(false, text));
						}
					}),
				],
			});
	},
);
