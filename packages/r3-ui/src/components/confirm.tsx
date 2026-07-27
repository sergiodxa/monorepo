/**
 * A convenience wrapper composing a two-control confirmation prompt in one
 * call: an {@link AlertDialog} panel prefilled with a heading, an optional
 * supporting passage, and a cancel/confirm control pair, so a single
 * consequential decision needs no compound assembly of its own. The
 * confirming control defaults to the semantic danger tone, pairing that tone
 * with an explicit confirmation step rather than a bare button for an
 * irreversible action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import type { Button } from "./button";

import { AlertDialog } from "./alert-dialog";

/** Semantic color role {@link Confirm} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Button.Color = "danger";

/**
 * Prop types for {@link Confirm}.
 */
export namespace Confirm {
	/**
	 * Per-part styling for the elements this convenience wrapper composes in
	 * one call, layered after each part's own built-in styling.
	 */
	export interface PartsProps {
		/** Styling for the header slot wrapping the title and description, rendered through {@link AlertDialog.Header}. */
		header?: TagProps<"div">["mix"];
		/** Styling for the heading, rendered through {@link AlertDialog.Title}, whichever heading tag its ambient level resolves to. */
		title?: TagProps<"h1" | "h2" | "h3" | "h4" | "h5" | "h6">["mix"];
		/** Styling for the supporting description, rendered through {@link AlertDialog.Description} only when `description` is set. */
		description?: TagProps<"p">["mix"];
		/** Styling for the action row wrapping the cancel and confirm controls, rendered through {@link AlertDialog.Footer}. */
		footer?: TagProps<"div">["mix"];
		/** Styling for the control that backs out without confirming, rendered through {@link AlertDialog.Cancel}. */
		cancel?: TagProps<"button">["mix"];
		/** Styling for the confirming control, rendered through {@link AlertDialog.Action}. */
		action?: TagProps<"button">["mix"];
	}

	/**
	 * Props accepted by {@link Confirm}. `mix` styles the underlying
	 * {@link AlertDialog} host directly; style the composed header, title,
	 * description, footer, and controls individually through `parts` instead.
	 */
	export interface Props extends Omit<AlertDialog.Props, "id" | "children" | "title"> {
		/**
		 * Stable identifier the panel renders as its own `id`. A trigger
		 * elsewhere on the page points `commandfor` at this same value with
		 * `command="show-modal"`; the cancel control and {@link AlertDialog.Action}
		 * this wrapper composes internally point back at it automatically.
		 */
		id: string;
		/** The panel's heading, rendered through {@link AlertDialog.Title}. */
		title: RemixNode;
		/**
		 * Supporting copy rendered through {@link AlertDialog.Description}
		 * beneath the title. Omit to render no description.
		 */
		description?: RemixNode;
		/** Label for the confirming control, rendered through {@link AlertDialog.Action}. */
		confirmLabel: RemixNode;
		/** Label for the control that backs out without confirming, rendered through {@link AlertDialog.Cancel}. */
		cancelLabel: RemixNode;
		/** Semantic color for the confirming control. Defaults to {@link DEFAULT_COLOR}. */
		color?: Button.Color;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a complete confirmation prompt in one call: an {@link AlertDialog}
 * panel whose header holds {@link Confirm.Props.title} and, when supplied,
 * {@link Confirm.Props.description}, and whose footer holds a cancel control
 * before the confirming {@link AlertDialog.Action}, colored with the semantic
 * danger tone unless {@link Confirm.Props.color} says otherwise. The title's
 * and description's own ids are computed from this instance's stable
 * identifier and wired to the panel's `aria-labelledby`/`aria-describedby`
 * automatically, unless a consumer overrides either explicitly, so no id
 * bookkeeping is left to the caller.
 *
 * Every detail {@link AlertDialog} already carries — the fixed `alertdialog`
 * role, sealing the panel against backdrop light-dismiss, the native
 * `<dialog>` host and its `::backdrop` treatment — rides along unchanged,
 * since this component composes it directly instead of duplicating its
 * markup or styling. Opening the panel still rides Invoker Commands exactly
 * as {@link AlertDialog} does: a trigger elsewhere on the page points
 * `commandfor` at this instance's `id` with `command="show-modal"`. Composing
 * {@link AlertDialog} and its compound parts directly instead remains
 * available for a confirmation prompt whose layout or wiring this wrapper
 * doesn't cover.
 *
 * @param handle Runtime handle carrying the panel's props and this instance's stable identifier.
 * @returns The render function producing the confirmation prompt's markup.
 * @example
 * <Button commandfor="confirm-delete" command="show-modal" color="danger">{t("project.delete")}</Button>
 * <Confirm
 * 	id="confirm-delete"
 * 	title={t("project.deleteTitle")}
 * 	description={t("project.deleteDescription")}
 * 	confirmLabel={t("actions.delete")}
 * 	cancelLabel={t("actions.cancel")}
 * />
 * @example
 * <Confirm
 * 	id="publish-post"
 * 	title={t("post.publishTitle")}
 * 	confirmLabel={t("actions.publish")}
 * 	cancelLabel={t("actions.cancel")}
 * 	color="brand"
 * />
 */
export function Confirm(handle: Handle<Confirm.Props>) {
	return () => {
		let {
			id,
			title,
			description,
			confirmLabel,
			cancelLabel,
			color,
			"aria-labelledby": ariaLabelledByProp,
			"aria-describedby": ariaDescribedByProp,
			parts,
			mix,
			...rest
		} = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let titleId = `${handle.id}-title`;
		let descriptionId = description ? `${handle.id}-description` : undefined;

		return (
			<AlertDialog
				{...rest}
				id={id}
				aria-labelledby={ariaLabelledByProp ?? titleId}
				aria-describedby={ariaDescribedByProp ?? descriptionId}
				mix={mix}
			>
				<AlertDialog.Header mix={parts?.header}>
					<AlertDialog.Title id={titleId} mix={parts?.title}>
						{title}
					</AlertDialog.Title>
					{description ? (
						<AlertDialog.Description id={descriptionId} mix={parts?.description}>
							{description}
						</AlertDialog.Description>
					) : null}
				</AlertDialog.Header>
				<AlertDialog.Footer mix={parts?.footer}>
					<AlertDialog.Cancel commandfor={id} mix={parts?.cancel}>
						{cancelLabel}
					</AlertDialog.Cancel>
					<AlertDialog.Action commandfor={id} color={resolvedColor} mix={parts?.action}>
						{confirmLabel}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog>
		);
	};
}
