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

import { flex, flexCol, gap } from "@pkg/u/layout";

import type { Button } from "./button";

import { AlertDialog } from "./alert-dialog";

/** Semantic color role {@link Confirm} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Button.Color = "danger";

/** HTTP method a submitting {@link Confirm} falls back to when `form.method` is omitted. */
const DEFAULT_METHOD: NonNullable<Confirm.FormProps["method"]> = "post";

/**
 * Column gap the wrapping `<form>` re-declares in submit mode, matching the
 * gap the panel itself lays its own children out with — the form becomes the
 * panel's single child, so without this the header and footer would lose the
 * spacing the panel's own layout gives them.
 */
const PANEL_GAP = 6;

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
		/** Styling for the `<form>` wrapping the panel's content, rendered only in submit mode. */
		form?: TagProps<"form">["mix"];
	}

	/**
	 * The submission a confirming control performs instead of merely closing
	 * the panel. Passing this at all switches {@link Confirm} into submit
	 * mode: the panel's content is wrapped in a real `<form>` and the
	 * confirming control becomes that form's submit button, which is the shape
	 * a server-rendered destructive action needs — the response to the
	 * submission is what ends the interruption, not a `close` command.
	 */
	export interface FormProps {
		/** URL the confirmation submits to. Omit to submit to the current URL, as a native `<form>` with no `action` does. */
		action?: string;
		/** HTTP method the confirmation submits with. Defaults to {@link DEFAULT_METHOD}, since a confirmed action changes state. */
		method?: "get" | "post";
		/**
		 * Hidden inputs submitted along with the confirmation — a CSRF token,
		 * an intent discriminator, the id of the record being acted on. They
		 * render first inside the form, before the panel's own content.
		 */
		fields?: RemixNode;
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
		/**
		 * Submission the confirming control performs. Omit for a client-side
		 * confirmation, where confirming only closes the panel and whatever
		 * else should happen is left to the page. Set it for a server-side
		 * action, where confirming submits a real form.
		 */
		form?: FormProps;
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
 * Without {@link Confirm.Props.form}, confirming only closes the panel — the
 * client-side shape, where the page decides what a confirmed decision means.
 * Passing `form` switches to the server-side shape instead: the panel's
 * content is wrapped in a real `<form>` carrying that `action`/`method` plus
 * any hidden `fields`, and the confirming control becomes its submit button,
 * so the action runs as an ordinary form submission with no client JavaScript
 * involved. Since that mode renders a `<form>`, a submitting panel must not
 * sit inside another form's markup, the same nesting rule the platform
 * already imposes.
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
 * @example
 * <Confirm
 * 	id="revoke-session"
 * 	title={t("session.revokeTitle")}
 * 	confirmLabel={t("actions.revoke")}
 * 	cancelLabel={t("actions.cancel")}
 * 	form={{ action: revokeUrl, fields: <input type="hidden" name="csrf" value={token} /> }}
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
			form,
			"aria-labelledby": ariaLabelledByProp,
			"aria-describedby": ariaDescribedByProp,
			parts,
			mix,
			...rest
		} = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let titleId = `${handle.id}-title`;
		let descriptionId = description ? `${handle.id}-description` : undefined;
		let content = (
			<>
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
					<AlertDialog.Action
						type={form ? "submit" : undefined}
						commandfor={form ? undefined : id}
						color={resolvedColor}
						mix={parts?.action}
					>
						{confirmLabel}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</>
		);

		return (
			<AlertDialog
				{...rest}
				id={id}
				aria-labelledby={ariaLabelledByProp ?? titleId}
				aria-describedby={ariaDescribedByProp ?? descriptionId}
				mix={mix}
			>
				{form ? (
					<form
						action={form.action}
						method={form.method ?? DEFAULT_METHOD}
						mix={[flex(), flexCol(), gap(PANEL_GAP), parts?.form]}
					>
						{form.fields}
						{content}
					</form>
				) : (
					content
				)}
			</AlertDialog>
		);
	};
}
