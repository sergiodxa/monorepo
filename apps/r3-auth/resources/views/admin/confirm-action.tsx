/**
 * A destructive action behind an explicit confirmation: a trigger button, a native
 * modal `<dialog>` opened by the Invoker Commands attributes on that button, and a real
 * form inside the dialog that posts the page's `intent`. Every admin deletion and
 * revocation goes through it, so the confirmation is part of the submission rather than
 * a script that decides whether to submit afterwards.
 *
 * The composition is hand-rolled so the hidden `intent` fields sit inside the dialog's
 * own form, and the trigger and cancel controls need no `type` of their own: an invoker
 * button inside a form carries the right one already.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { AlertDialog, Button } from "@pkg/r3-ui";

namespace ConfirmAction {
	/** Trigger button sizes, matching the component library's own scale. */
	export type Size = "sm" | "md" | "lg";

	export interface Props {
		/**
		 * Identifier shared by the trigger's `commandfor` and the dialog's `id`. It must
		 * be unique on the page, so a list passes the row's id through it.
		 */
		id: string;
		/** Label on the button that opens the dialog. */
		trigger: string;
		/** Heading inside the dialog, naming the consequence. */
		title: string;
		/** Sentence explaining what cannot be undone. */
		description: string;
		/** Label on the submitting control. */
		confirmLabel: string;
		/** Label on the control that closes the dialog without submitting. */
		cancelLabel: string;
		/** Hidden fields posted with the confirmation, always including `intent`. */
		fields: Record<string, string>;
		/** Size of the trigger button, so a table row can offer a smaller one. */
		size?: Size;
	}
}

/** Renders a trigger button plus the modal confirmation form it opens. */
export default function ConfirmAction(handle: Handle<ConfirmAction.Props>) {
	return () => {
		let { id, trigger, title, description, confirmLabel, cancelLabel, fields, size } = handle.props;
		let titleId = `${id}-title`;
		let descriptionId = `${id}-description`;

		return (
			<>
				<Button color="danger" size={size} commandfor={id} command="show-modal">
					{trigger}
				</Button>

				<AlertDialog id={id} aria-labelledby={titleId} aria-describedby={descriptionId}>
					<AlertDialog.Header>
						<AlertDialog.Title id={titleId}>{title}</AlertDialog.Title>
						<AlertDialog.Description id={descriptionId}>{description}</AlertDialog.Description>
					</AlertDialog.Header>

					{/* A real form: the dialog asks the question and the same markup answers it. */}
					<form method="post">
						{Object.entries(fields).map(([name, value]) => (
							<input key={name} type="hidden" name={name} value={value} />
						))}

						<AlertDialog.Footer>
							<AlertDialog.Cancel commandfor={id}>{cancelLabel}</AlertDialog.Cancel>
							<Button type="submit" color="danger">
								{confirmLabel}
							</Button>
						</AlertDialog.Footer>
					</form>
				</AlertDialog>
			</>
		);
	};
}
