/**
 * One field of Quoin's enquiry form: its caption, its control and a correction that appears
 * once the browser marks the control `:user-invalid`, so the form explains itself after a
 * reader has tried it and with no script on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Label } from "@sdxc/ui";

import { caption } from "~/resources/views/demos/studio/grid";

namespace StudioField {
	/** The caption, the control and what to say when its value is refused. */
	export interface Props {
		/** The control's `id`, which the caption points at. */
		htmlFor: string;
		/** The caption. */
		label: RemixNode;
		/** Set after the caption in the caption face, such as "Optional". */
		aside?: RemixNode;
		/** The correction shown once the control is `:user-invalid`; an optional control has none. */
		hint?: RemixNode;
		/** The control. */
		children: RemixNode;
	}
}

/**
 * Renders the caption over the control with the correction hidden under it. The browser
 * sets `:user-invalid` only after the reader has edited the control or tried to submit,
 * so an untouched form shows no errors.
 *
 * @param handle Runtime handle carrying the field's parts.
 * @returns The render function producing the field.
 */
export default function StudioField(handle: Handle<StudioField.Props>) {
	return () => {
		let { aside, children, hint, htmlFor, label } = handle.props;

		return (
			<div
				data-slot="studio-field"
				mix={[raw({ display: "grid", gap: "0.5rem", alignContent: "start" })]}
			>
				<span mix={[raw({ display: "flex", justifyContent: "space-between", gap: "1rem" })]}>
					<Label htmlFor={htmlFor}>{label}</Label>
					{aside ? <span mix={[caption()]}>{aside}</span> : null}
				</span>
				{children}
				{hint ? (
					<span
						data-slot="studio-hint"
						mix={[
							raw({ display: "none", fontSize: "0.875rem", color: "var(--ui-danger-fg)" }),
							when('[data-slot="studio-field"]:has(:user-invalid) &', raw({ display: "block" })),
						]}
					>
						{hint}
					</span>
				) : null}
			</div>
		);
	};
}
