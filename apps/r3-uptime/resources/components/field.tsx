/**
 * Label + control wrapper for a single form field, matching the app's
 * `<label><span>Label</span><input/></label>` convention. Exists so every form's
 * field markup shares one composition of {@link s.field} instead of repeating the
 * label/span wrapper per input across every `form.tsx`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import * as s from "~/resources/styles";

namespace Field {
	export interface Props {
		label: string;
		children: RemixNode;
	}
}

/** Wraps `children` (an input/select/textarea) with {@link Field.Props.label} using {@link s.field}. */
export default function Field(handle: Handle<Field.Props>) {
	return () => (
		<label mix={[s.field]}>
			<span>{handle.props.label}</span>
			{handle.props.children}
		</label>
	);
}
