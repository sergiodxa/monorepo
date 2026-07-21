/**
 * Copies the text content of the element a Message footer action button's
 * `commandfor` points at onto the system clipboard, and reports whether the
 * write landed by dispatching a namespaced event on the button itself.
 *
 * Why JS: `navigator.clipboard.writeText()` is a script-only API with no
 * HTML form, attribute, or Invoker Command equivalent — nothing in markup
 * can place text on the system clipboard on its own.
 * No-JS baseline: the button renders in its usual place, stays reachable in
 * Tab order, and reads its accessible label normally; only the copy action
 * itself goes silent until a script backs it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { DISABLED_SELECTOR } from "../utils/disabled-selector";

/**
 * Custom Invoker Command a Message footer copy button declares
 * (`command={COPY_COMMAND}`, `commandfor` pointing at the message content to
 * copy) so the pairing reads as a real invoker relationship in markup, even
 * though {@link copyToClipboard} itself reacts to the button's click rather
 * than to the command bubbling off its target.
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
 * a clipboard write settles, carrying whether it succeeded and the text that
 * was attempted, so a consumer can render its own feedback — a toast, a
 * temporary label swap, an icon change — for either outcome instead of
 * polling the clipboard itself.
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
 * Writes the text content of the element a Message footer copy button's
 * `commandfor` points at onto the system clipboard through
 * `navigator.clipboard.writeText()`. Resolves the target from the button's
 * own `commandfor` reference on every press, rather than assuming a fixed
 * position among siblings, and ignores a press on a disabled button or one
 * whose target resolves to no text.
 *
 * Once the write settles, dispatches {@link CopyEvent} on the button
 * carrying whether it succeeded and the text that was attempted, leaving
 * every visible outcome of that — an icon swap, a status message, a toast —
 * to whatever feedback the consuming app renders around it.
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
