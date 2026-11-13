/**
 * Why JS: a picker in a popover saves as a model, once, when the reader is done with it, and
 * only script hears the popover close. This submits the form when its popover closes changed.
 * No-JS baseline: the form keeps a Save button for the browser to submit it with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/**
 * What a form would send right now, as one comparable string in sorted order, so an untouched
 * form, one changed back to its starting values, and one whose fields moved all compare equal.
 */
function snapshot(form: HTMLFormElement): string {
	return [...new FormData(form)]
		.map(([name, value]) => `${name}=${typeof value === "string" ? value : value.name}`)
		.sort()
		.join("&");
}

/**
 * Applied to an element inside a form inside a popover: records the form's values each time
 * the popover opens and, when it closes holding different values, submits the form through
 * `requestSubmit`, so the app's own submit handling (a frame, a fetch) takes the request.
 *
 * @example <div mix={[submitOnClose()]}>{checkboxes}</div>
 */
export const submitOnClose: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let form = event.node.closest("form");
		let popover = event.node.closest<HTMLElement>("[popover]");
		if (!form || !popover) return;
		let opened = snapshot(form);
		popover.addEventListener(
			"toggle",
			(toggle) => {
				if (toggle.newState === "open") {
					opened = snapshot(form);
					return;
				}
				if (snapshot(form) === opened) return;
				opened = snapshot(form);
				form.requestSubmit();
			},
			{ signal: controller.signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
