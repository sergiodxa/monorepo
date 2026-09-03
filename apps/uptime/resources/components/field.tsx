/**
 * Shares one label/control/helper-text composition across every form so it isn't
 * repeated per input in each `form.tsx`. Wraps `children` directly rather than
 * pairing through `for`/`id`, since `children` can be a `<select>`, `<textarea>`,
 * or a custom slider that only a native `<label>` nesting handles — `@sdxc/ui`'s
 * `TextField` bundles its own `<input>` and doesn't fit here.
 *
 * Ends with no trailing margin: spacing to the next field comes from the
 * containing card body's `gap`, so this wrapper stays correct wherever it's placed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Description, Label } from "@sdxc/ui";
import { fieldStackLayout } from "@sdxc/ui/styles";

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
