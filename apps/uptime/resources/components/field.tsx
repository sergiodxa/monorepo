/**
 * Label + control (+ optional helper text) wrapper for a single form field, matching
 * the app's `<label><span>Label</span><input/></label>` convention plus a muted
 * description line below. Exists so every form's field markup shares one composition
 * of the label/span/helper-text wrapper instead of repeating it per input across
 * every `form.tsx`.
 *
 * Composes `@pkg/ui`'s `Label` and `Description` for the caption and helper
 * text, and its shared `fieldStackLayout()` style helper for both levels of
 * vertical stacking this wrapper needs: the label text above its control inside
 * `Label` itself, and the whole field (label, control, description) stacked
 * above the next one. `@pkg/ui`'s own `TextField` bundles its own `<input>`
 * and doesn't fit here, since this wrapper's `children` can be a `<select>`, a
 * `<textarea>`, or a custom slider — anything a native `<label>` can wrap by
 * nesting rather than by `for`/`id`, which is why `Label` wraps `children`
 * directly instead of pairing with it through an `id`.
 *
 * It deliberately ends in no trailing margin: the distance to the next field is the
 * containing card body's `gap`, so this wrapper stays correct wherever it is placed
 * and a container never has to know which of its children brought their own spacing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Description, Label } from "@pkg/ui";
import { fieldStackLayout } from "@pkg/ui/styles";

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
		<div mix={[fieldStackLayout()]}>
			<Label mix={[fieldStackLayout()]}>
				<span>{handle.props.label}</span>
				{handle.props.children}
			</Label>
			{handle.props.description && <Description>{handle.props.description}</Description>}
		</div>
	);
}
