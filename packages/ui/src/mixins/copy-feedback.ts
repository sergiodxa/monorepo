/**
 * Confirms a copy on the button that made it: the button carries `data-copied` for two
 * seconds, so its styles can swap the copy glyph for a check, and its status region reads
 * the confirmation out. Pairs with {@link copyToClipboard}, whose event it answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin, on } from "remix/component";

/** How long a button reads as copied after a successful write. */
const CONFIRM_MS = 2000;

/** Attribute the button carries while it confirms a copy. */
export const COPIED_ATTRIBUTE = "data-copied";

/**
 * Marks its host button as copied after every successful {@link copyToClipboard} write and
 * writes `copiedLabel` into the `[role="status"]` element inside it, which a screen reader
 * announces; both clear after two seconds, and a second copy restarts the clock.
 *
 * @param copiedLabel The confirmation a screen reader announces, such as "Copied".
 * @returns A mixin descriptor for the copy button's `mix` prop.
 * @example
 * <button commandfor="code" command={COPY_COMMAND} mix={[copyToClipboard(), copyFeedback(t("copied"))]}>
 * 	<CopyIcon />
 * 	<span role="status" mix={[visuallyHidden()]} />
 * </button>
 */
export const copyFeedback: MixinFactory<HTMLButtonElement, [copiedLabel: string], ElementProps> =
	createMixin<HTMLButtonElement, [copiedLabel: string], ElementProps>((handle) => {
		let timer: ReturnType<typeof setTimeout> | undefined;

		handle.addEventListener("remove", () => clearTimeout(timer));

		return (copiedLabel) =>
			createElement(handle.element, {
				mix: [
					on<HTMLButtonElement, "ui:copy">("ui:copy", (event) => {
						if (!event.success) return;
						let button = event.currentTarget;
						let status = button.querySelector('[role="status"]');

						button.setAttribute(COPIED_ATTRIBUTE, "");
						if (status) status.textContent = copiedLabel;

						clearTimeout(timer);
						timer = setTimeout(() => {
							button.removeAttribute(COPIED_ATTRIBUTE);
							if (status) status.textContent = "";
						}, CONFIRM_MS);
					}),
				],
			});
	});
