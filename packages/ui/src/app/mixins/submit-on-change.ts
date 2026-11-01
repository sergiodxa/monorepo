/**
 * Why JS: a form submits only from a button, so script is what saves a switch the moment
 * it flips; this submits the form whenever one of its controls changes.
 * No-JS baseline: the form keeps a Save button for the browser to submit it with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/**
 * Applied to any element inside a form: submits that form through `requestSubmit` on every
 * `change`, so the app's own submit handling (a frame, a fetch) takes the request.
 *
 * @example <span hidden mix={[submitOnChange()]} />
 */
export const submitOnChange: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let form = event.node.closest("form");
		form?.addEventListener("change", () => form.requestSubmit(), { signal: controller.signal });
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
