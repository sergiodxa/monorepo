/**
 * Client island: closes the marketing header's phone sheet when the visitor follows one of
 * its links or taps the backdrop. A same-page link such as `/#pricing` scrolls without a
 * new document, so the sheet would otherwise stay open over the section it scrolled to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hidden } from "@sdxc/u/layout";
import { clientEntry, ref } from "remix/component";

/**
 * Closes the `<dialog>` it renders inside. It owns no visible markup, and a page restored
 * from the back-forward cache comes back with the sheet closed, since the link that left
 * the page closed it first.
 */
export const SheetDismiss = clientEntry(import.meta.url, function SheetDismiss() {
	return () => (
		<span
			mix={[
				hidden(),
				ref((node, signal) => {
					let sheet = node.closest("dialog");
					if (!sheet) return;

					sheet.addEventListener(
						"click",
						(event) => {
							if (isBackdropClick(sheet, event) || isPlainLinkClick(event)) sheet.close();
						},
						{ signal },
					);
				}),
			]}
		/>
	);
});

/**
 * Whether a click landed on the backdrop. A press on `::backdrop` is dispatched to the
 * dialog itself, at a point outside the panel's own box.
 */
function isBackdropClick(sheet: HTMLDialogElement, event: MouseEvent): boolean {
	if (event.target !== sheet) return false;
	let box = sheet.getBoundingClientRect();
	return (
		event.clientX < box.left ||
		event.clientX > box.right ||
		event.clientY < box.top ||
		event.clientY > box.bottom
	);
}

/**
 * Whether a click follows a link in this tab. A modified click opens the page elsewhere,
 * and the visitor who made it is still using the sheet.
 */
function isPlainLinkClick(event: MouseEvent): boolean {
	if (event.defaultPrevented || event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	if (!(event.target instanceof Element)) return false;
	let link = event.target.closest("a[href]");
	return link !== null && link.getAttribute("target") !== "_blank";
}
