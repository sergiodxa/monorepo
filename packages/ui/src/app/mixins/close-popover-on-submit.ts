/**
 * Why JS: a page that answers a submit in place keeps an open popover open, while a full page
 * load closes it. No-JS baseline: the submit loads the next page, and the popover starts closed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/**
 * Closes the popover holding the host whenever the host's form submits, by its own click or by
 * Enter in any of the form's fields, so applying a choice always returns the visitor to the page.
 * The form's fields stay in place while it closes, so the submission carries every value.
 *
 * @example <Button type="submit" form={formId} mix={[closePopoverOnSubmit()]}>Apply</Button>
 */
export const closePopoverOnSubmit: MixinFactory<HTMLButtonElement, []> = createMixin<
	HTMLButtonElement,
	[]
>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let button = event.node;
		button.form?.addEventListener(
			"submit",
			function closeHolder() {
				let popover = button.closest<HTMLElement>("[popover]");
				if (popover?.matches(":popover-open")) popover.hidePopover();
			},
			{ signal: controller.signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
