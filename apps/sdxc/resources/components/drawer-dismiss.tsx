/**
 * Client island: closes the navigation drawer it sits in when the reader taps outside it
 * or follows one of its links. A browser without `closedby` gives a modal dialog no
 * dismissal a touch screen can reach, so the drawer would otherwise stay open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry, ref } from "remix/component";

/**
 * Closes the `<dialog>` this renders inside. It owns no markup, and a page restored from
 * the back-forward cache comes back with the drawer closed, since the link that left it
 * closed it first.
 */
export const DrawerDismiss = clientEntry(
	"/resources/components/drawer-dismiss.tsx#DrawerDismiss",
	function DrawerDismiss(_: Handle) {
		return () => (
			<span
				mix={[
					hidden(),
					ref((node, signal) => {
						let drawer = node.closest("dialog");
						if (!drawer) return;

						drawer.addEventListener(
							"click",
							(event) => {
								if (isOutside(drawer, event) || isPlainLinkClick(event)) drawer.close();
							},
							{ signal },
						);
					}),
				]}
			/>
		);
	},
);

/**
 * Whether a click landed on the backdrop. A press on `::backdrop` is dispatched to the
 * dialog itself, at a point outside the panel's own box.
 */
function isOutside(drawer: HTMLDialogElement, event: MouseEvent): boolean {
	if (event.target !== drawer) return false;
	let box = drawer.getBoundingClientRect();
	return (
		event.clientX < box.left ||
		event.clientX > box.right ||
		event.clientY < box.top ||
		event.clientY > box.bottom
	);
}

/**
 * Whether a click follows a link in this tab. A modified click opens the page elsewhere,
 * and the reader who made it is still using the drawer.
 */
function isPlainLinkClick(event: MouseEvent): boolean {
	if (event.defaultPrevented || event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	if (!(event.target instanceof Element)) return false;
	let link = event.target.closest("a[href]");
	return link !== null && link.getAttribute("target") !== "_blank";
}
