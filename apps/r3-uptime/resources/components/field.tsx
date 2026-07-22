/**
 * Label + control (+ optional helper text) wrapper for a single form field, matching
 * the app's `<label><span>Label</span><input/></label>` convention plus a muted
 * description line below. Exists so every form's field markup shares one composition
 * of the label/span/helper-text wrapper instead of repeating it per input across
 * every `form.tsx`.
 *
 * Composes `@pkg/r3-ui`'s `Label` and `Description` for the caption and helper
 * text, and its shared `fieldStackLayout()` style helper for both levels of
 * vertical stacking this wrapper needs: the label text above its control inside
 * `Label` itself, and the whole field (label, control, description) stacked
 * above the next one. `@pkg/r3-ui`'s own `TextField` bundles its own `<input>`
 * and doesn't fit here, since this wrapper's `children` can be a `<select>`, a
 * `<textarea>`, or a custom slider — anything a native `<label>` can wrap by
 * nesting rather than by `for`/`id`, which is why `Label` wraps `children`
 * directly instead of pairing with it through an `id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Description, Label } from "@pkg/r3-ui";
import { fieldStackLayout } from "@pkg/r3-ui/styles";
import { css } from "remix/ui";

namespace Field {
	export interface Props {
		label: string;
		/** Muted helper text rendered below the control. */
		description?: string;
		children: RemixNode;
	}
}

/** Wraps `children` (an input/select/textarea) with a label and optional description. */
export default function Field(handle: Handle<Field.Props>) {
	return () => (
		<div mix={[fieldStackLayout(), css({ marginBottom: 28 })]}>
			<Label mix={[fieldStackLayout()]}>
				<span>{handle.props.label}</span>
				{handle.props.children}
			</Label>
			{handle.props.description && <Description>{handle.props.description}</Description>}
		</div>
	);
}
