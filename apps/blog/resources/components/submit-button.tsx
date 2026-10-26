/**
 * The submit button of the site's contact forms. Once a valid submission starts it turns busy,
 * so a double click sends one request; a page restored from the back/forward cache comes back
 * ready to send again. The form posts the same way before this island loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Button } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** Props of {@link SubmitButton}, serialized into the page for hydration. */
export type SubmitButtonProps = {
	label: string;
	/** What the button says while the request is in flight. */
	pendingLabel: string;
};

/**
 * Marks the submission pending on a click that will submit. The form's own validation runs
 * first, so a click the browser refuses for an empty required field leaves the form editable;
 * pressing Enter in a field clicks the button too, so it takes the same path.
 */
export const SubmitButton = clientEntry(
	import.meta.url,
	function SubmitButton(handle: Handle<SubmitButtonProps>) {
		let pending = false;

		handle.queueTask(() => {
			window.addEventListener(
				"pageshow",
				(event) => {
					if (!event.persisted || !pending) return;
					pending = false;
					void handle.update();
				},
				{ signal: handle.signal },
			);
		});

		return () => (
			<Button
				type="submit"
				color="brand"
				isPending={pending}
				mix={[
					on<HTMLButtonElement, "click">("click", (event) => {
						let form = event.currentTarget.form;
						if (pending) {
							event.preventDefault();
							return;
						}
						if (form && !form.checkValidity()) return;
						pending = true;
						void handle.update();
					}),
				]}
			>
				{pending ? handle.props.pendingLabel : handle.props.label}
			</Button>
		);
	},
);
