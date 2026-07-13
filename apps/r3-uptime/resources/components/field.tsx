/**
 * Label + control (+ optional helper text) wrapper for a single form field, matching
 * the app's `<label><span>Label</span><input/></label>` convention plus a muted
 * description line below. Exists so every form's field markup shares one composition
 * of the label/span/helper-text wrapper instead of repeating it per input across
 * every `form.tsx`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { neutral } from "~/resources/theme";

namespace Field {
	export interface Props {
		label: string;
		/** Muted helper text rendered below the control. */
		description?: string;
		children: RemixNode;
	}
}

const wrapper = css({ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 });

const label = css({
	display: "flex",
	flexDirection: "column",
	gap: 6,
	fontSize: "0.875rem",
	fontWeight: 600,
});

const description = css({
	margin: 0,
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** Wraps `children` (an input/select/textarea) with a label and optional description. */
export default function Field(handle: Handle<Field.Props>) {
	return () => (
		<div mix={[wrapper]}>
			<label mix={[label]}>
				<span>{handle.props.label}</span>
				{handle.props.children}
			</label>
			{handle.props.description && <p mix={[description]}>{handle.props.description}</p>}
		</div>
	);
}
