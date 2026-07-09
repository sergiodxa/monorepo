/**
 * Label + control wrapper for a single form field, matching the app's
 * `<label><span>Label</span><input/></label>` convention. Exists so every form's
 * field markup shares one composition of the label/span wrapper instead of
 * repeating it per input across every `form.tsx`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

namespace Field {
	export interface Props {
		label: string;
		children: RemixNode;
	}
}

/** Wraps `children` (an input/select/textarea) with {@link Field.Props.label}. */
export default function Field(handle: Handle<Field.Props>) {
	return () => (
		<label
			mix={[
				css({
					display: "flex",
					flexDirection: "column",
					gap: 4,
					marginBottom: 20,
					fontSize: "0.875rem",
					fontWeight: 500,
				}),
			]}
		>
			<span>{handle.props.label}</span>
			{handle.props.children}
		</label>
	);
}
