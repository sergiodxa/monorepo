/**
 * Shares one label/control/helper-text composition across every form so it isn't
 * repeated per input in each `form.tsx`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { Description, FieldError, Label } from "@sdxc/ui";
import { fieldStackLayout } from "@sdxc/ui/styles";

namespace Field {
	export interface Props {
		label: string;
		/** Muted helper text rendered below the control. */
		description?: string;
		/** Validation message rendered below the description, in the danger color. */
		error?: string;
		/** DOM id of the error, for the control's `aria-describedby`. */
		errorId?: string;
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
			{handle.props.error && (
				<FieldError id={handle.props.errorId}>{handle.props.error}</FieldError>
			)}
		</div>
	);
}
