/**
 * Why JS: only script can open a `<dialog>` as a modal, and a modal's close leaves the address
 * naming it. No-JS baseline: the dialog shows fixed over a backdrop link, and that link, or the
 * form's own answer, takes the page back to its address without the dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** The listeners bound to each dialog, so a second marker in one dialog replaces the first's. */
const BOUND = new WeakMap<HTMLDialogElement, AbortController>();

/**
 * Applied to a marker inside a `RouteDialog`: reopens the dialog as a modal so focus stays in it,
 * and once it stays closed after Escape or a close command, clicks the dialog's backdrop link, so
 * the navigation is the link's own (frame targeting and history included).
 *
 * @example <span hidden mix={[routeDialog()]} />
 */
export const routeDialog: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let dialog = event.node.closest("dialog");
		if (!dialog) return;
		BOUND.get(dialog)?.abort();
		BOUND.set(dialog, controller);
		let link = document.querySelector<HTMLAnchorElement>(
			`a[data-route-dialog-close="${CSS.escape(dialog.id)}"]`,
		);
		if (link) link.hidden = true;
		let stale = 0;
		if (dialog.open && !dialog.matches(":modal")) {
			dialog.close();
			dialog.showModal();
			stale = 1;
		}
		let submitted = false;
		dialog.addEventListener("submit", () => (submitted = true), { signal: controller.signal });
		dialog.addEventListener(
			"close",
			() => {
				if (stale > 0) {
					stale -= 1;
					return;
				}
				if (!submitted && !dialog.open && dialog.isConnected) link?.click();
			},
			{ signal: controller.signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
