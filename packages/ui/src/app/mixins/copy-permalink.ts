/**
 * Why JS: a copy-link button writes a record's URL to the clipboard, which only script
 * reaches. No-JS baseline: the button is inert and the record's URL is still the page's
 * own address bar, or the link the list renders for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin, on } from "remix/component";

/** How long the button reads as copied after a successful write. */
const COPIED_MS = 2000;

/**
 * Writes `permalink`, resolved against the page's URL so a relative path copies as a full
 * address, to the clipboard on every press. A successful write sets `data-copied` on the
 * button and writes `copiedLabel` into its `[role="status"]` element for two seconds.
 *
 * @param permalink The record's URL, absolute or relative to the page.
 * @param copiedLabel What a screen reader announces once the link is copied.
 * @returns A mixin descriptor for the button's `mix` prop.
 * @example
 * <button type="button" mix={[copyPermalink("/monitors/42", t("linkCopied"))]}>
 * 	<LinkIcon /><span role="status" mix={[visuallyHidden()]} />
 * </button>
 */
export const copyPermalink: MixinFactory<
	HTMLButtonElement,
	[permalink: string, copiedLabel: string],
	ElementProps
> = createMixin<HTMLButtonElement, [permalink: string, copiedLabel: string], ElementProps>(
	(handle) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		handle.addEventListener("remove", () => clearTimeout(timer));

		return (permalink, copiedLabel) =>
			createElement(handle.element, {
				mix: [
					on<HTMLButtonElement, "click">("click", async (event, signal) => {
						let button = event.currentTarget;
						let url = new URL(permalink, button.ownerDocument.location.href).href;
						try {
							await navigator.clipboard.writeText(url);
						} catch {
							return;
						}
						if (signal.aborted) return;

						let status = button.querySelector('[role="status"]');
						button.setAttribute("data-copied", "");
						if (status) status.textContent = copiedLabel;
						clearTimeout(timer);
						timer = setTimeout(() => {
							button.removeAttribute("data-copied");
							if (status) status.textContent = "";
						}, COPIED_MS);
					}),
				],
			});
	},
);
