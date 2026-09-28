/**
 * The honeypot fields as a `remix/ui` component: the signed token as a hidden input, and the trap
 * as a text input moved off-screen, out of the tab order, the accessibility tree and autofill.
 * It needs no client JavaScript, so the form stays a plain HTML form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { Honeypot } from "./index.js";

/** The props {@link HoneypotFields} accepts. */
export namespace HoneypotFields {
	/** The fields `Honeypot#issue` returned, plus the trap's label. */
	export interface Props extends Honeypot.Fields {
		/**
		 * The trap's label, read by anyone who reaches the field some unexpected way.
		 *
		 * @default "Leave this field empty"
		 */
		label?: string;
	}
}

/**
 * Renders the token and the trap inside a form. The trap stays in the layout, off-screen rather
 * than `display: none`, because form bots skip fields hidden that way; `inert`, `aria-hidden`
 * and `tabindex="-1"` keep people using a keyboard or assistive technology from reaching it.
 *
 * @param handle - Component handle exposing the issued fields
 * @returns A render function producing the fields' markup
 * @example <HoneypotFields {...fields} />
 */
export function HoneypotFields(handle: Handle<HoneypotFields.Props>) {
	return () => {
		let { tokenField, token, trapField, label = "Leave this field empty" } = handle.props;

		return (
			<>
				<input type="hidden" name={tokenField} value={token} />
				<div
					aria-hidden="true"
					inert
					mix={css({
						position: "absolute",
						insetInlineStart: "-10000px",
						inlineSize: "1px",
						blockSize: "1px",
						overflow: "hidden",
					})}
				>
					<label for={trapField}>{label}</label>
					<input
						type="text"
						id={trapField}
						name={trapField}
						value=""
						tabIndex={-1}
						autocomplete="off"
						data-1p-ignore
						data-lpignore="true"
						data-bwignore
						data-form-type="other"
					/>
				</div>
			</>
		);
	};
}
