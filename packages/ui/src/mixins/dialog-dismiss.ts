/**
 * Closes the modal `<dialog>` its host sits in when the visitor presses the backdrop or
 * follows a link inside it. Engines without `closedby` give a modal no touch dismissal, and
 * a same-page link such as `/#pricing` scrolls without a new document, leaving it open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/**
 * Listens on the host's closest `<dialog>` from insertion until removal. A modified click
 * or a `target="_blank"` link opens the page elsewhere and leaves the dialog open, since
 * the visitor who made it is still using it. A host outside any dialog does nothing.
 *
 * @example
 * <dialog id="menu" closedby="any">
 * 	<span hidden mix={[dialogDismiss()]} />
 * 	<a href="/#pricing">Pricing</a>
 * </dialog>
 */
export const dialogDismiss: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let dialog = event.node.closest("dialog");
		if (!dialog) return;
		controller = new AbortController();
		dialog.addEventListener(
			"click",
			(click) => {
				if (isBackdropClick(dialog, click) || isPlainLinkClick(click)) dialog.close();
			},
			{ signal: controller.signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/**
 * Whether a click landed on the backdrop. A press on `::backdrop` is dispatched to the
 * dialog itself, at a point outside the panel's own box.
 */
function isBackdropClick(dialog: HTMLDialogElement, event: MouseEvent): boolean {
	if (event.target !== dialog) return false;
	let box = dialog.getBoundingClientRect();
	return (
		event.clientX < box.left ||
		event.clientX > box.right ||
		event.clientY < box.top ||
		event.clientY > box.bottom
	);
}

/** Whether a click follows a link in this tab with the primary button and no modifier. */
function isPlainLinkClick(event: MouseEvent): boolean {
	if (event.defaultPrevented || event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	if (!(event.target instanceof Element)) return false;
	let link = event.target.closest("a[href]");
	return link !== null && link.getAttribute("target") !== "_blank";
}
