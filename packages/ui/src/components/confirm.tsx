/**
 * A convenience wrapper composing a two-control confirmation prompt in one
 * call: an {@link AlertDialog} panel prefilled with a heading, an optional
 * supporting passage, and a cancel/confirm control pair, so a single
 * consequential decision needs no compound assembly of its own. The
 * confirming control defaults to the semantic danger tone, and a
 * type-to-confirm variant holds a big irreversible action until its name is typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { flex, flexCol, gap, vstack } from "@sdxc/u/layout";
import { clientEntry } from "remix/component";

import { confirmPhrase } from "../mixins/confirm-phrase.js";

import type { Button } from "./button.js";

import { AlertDialog } from "./alert-dialog.js";
import { Input } from "./input.js";
import { Label } from "./label.js";

/** Semantic color role {@link Confirm} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Button.Color = "danger";

/** HTTP method a submitting {@link Confirm} falls back to when `form.method` is omitted. */
const DEFAULT_METHOD: NonNullable<Confirm.FormProps["method"]> = "post";

/**
 * Column gap the wrapping `<form>` re-declares in submit mode, matching the
 * panel's own child gap — the form becomes the panel's single child, so
 * without this the header and footer would lose their spacing.
 */
const PANEL_GAP = 6;

/** Characters a `pattern` (compiled with the `v` flag) reads as syntax, escaped to match literally. */
const PATTERN_SYNTAX = /[\\^$.*+?()[\]{}|/]/g;

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
	 * the panel. Passing this switches {@link Confirm} into submit mode, where
	 * the form's response is what ends the interruption.
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
	 * The phrase a person types before a big irreversible action unlocks, such as
	 * the team's name. Reserve it for deleting something large; on routine
	 * confirms it reads as melodrama.
	 */
	export interface TypeToConfirm {
		/** The exact text that unlocks the confirming control, compared case-sensitively. */
		value: string;
		/** The field's label, such as `Type "acme" to confirm`. */
		label: RemixNode;
		/** Name the typed text submits under in submit mode, so the server can check it again. */
		name?: string;
	}

	/**
	 * Props accepted by {@link Confirm}. `mix` styles the underlying
	 * {@link AlertDialog} host directly; style the composed header, title,
	 * description, footer, and controls individually through `parts` instead.
	 */
	export interface Props extends Omit<AlertDialog.Props, "id" | "children" | "title"> {
		/**
		 * Stable identifier the panel renders as its own `id`; a trigger
		 * elsewhere on the page targets it via `commandfor`/`command="show-modal"`,
		 * and the cancel and confirm controls point back at it automatically.
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
		 * Submission the confirming control performs. Omitting it leaves
		 * confirming as a close-only action for the page to react to; setting it
		 * submits a real form instead.
		 */
		form?: FormProps;
		/**
		 * Holds the confirming control disabled until this phrase is typed. Without
		 * script the field's `pattern` blocks the submission instead.
		 */
		typeToConfirm?: TypeToConfirm;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Composes {@link AlertDialog} into a confirmation prompt, wiring title and
 * description ids to `aria-labelledby`/`aria-describedby`. Focus opens on Cancel, or
 * on the phrase field with `typeToConfirm`; pass `form` to submit a real `<form>`.
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
 * @example
 * <Confirm
 * 	id="delete-team"
 * 	title="Delete team?"
 * 	description="Acme, its 12 monitors and their history are deleted."
 * 	confirmLabel="Delete team"
 * 	cancelLabel="Cancel"
 * 	typeToConfirm={{ value: "acme", label: 'Type "acme" to confirm', name: "confirmation" }}
 * 	form={{ action: "/teams/acme/delete" }}
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
			typeToConfirm,
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
				{typeToConfirm ? (
					<ConfirmPhrase
						id={`${handle.id}-phrase`}
						value={typeToConfirm.value}
						label={typeToConfirm.label}
						name={typeToConfirm.name}
					/>
				) : null}
				<AlertDialog.Footer mix={parts?.footer}>
					{/* oxlint-disable-next-line jsx-a11y/no-autofocus -- Focus inside an opened modal, where a destructive confirm starts on the safe choice. */}
					<AlertDialog.Cancel
						commandfor={id}
						autofocus={typeToConfirm ? undefined : true}
						mix={parts?.cancel}
					>
						{cancelLabel}
					</AlertDialog.Cancel>
					<AlertDialog.Action
						data-confirm-action=""
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

/**
 * Props {@link ConfirmPhrase} serializes into the page for hydration, which is why they are
 * a `type`: `SerializableProps` rejects an interface.
 */
export type ConfirmPhraseProps = {
	/** The input's `id`, which its label points at. */
	id: string;
	/** The exact text that unlocks the confirming control. */
	value: string;
	label: RemixNode;
	name?: string;
};

/**
 * Turns a phrase into a `pattern` that matches only that phrase.
 *
 * @param value The phrase to match literally.
 * @returns The phrase with every pattern syntax character escaped.
 */
function escapePattern(value: string): string {
	return value.replace(PATTERN_SYNTAX, "\\$&");
}

/**
 * Client island: the field a type-to-confirm prompt holds. It disables the dialog's
 * confirming control until the typed text matches and clears itself when the dialog
 * closes, so every opening starts locked; without script, `pattern` blocks the submit.
 *
 * @example
 * <ConfirmPhrase id="delete-team-phrase" value="acme" label='Type "acme" to confirm' />
 */
export const ConfirmPhrase: EntryComponent<ConfirmPhraseProps> = clientEntry(
	"@sdxc/ui/confirm#ConfirmPhrase",
	function ConfirmPhrase(handle) {
		return () => {
			let { id, label, name, value } = handle.props;

			return (
				<div data-slot="confirm-phrase" mix={[vstack({ gap: 1.5, align: "stretch" })]}>
					<Label htmlFor={id}>{label}</Label>
					{/* oxlint-disable-next-line jsx-a11y/no-autofocus -- Focus inside an opened modal, landing on the one field the decision needs. */}
					<Input
						id={id}
						name={name}
						required
						autofocus
						autocomplete="off"
						spellcheck={false}
						pattern={escapePattern(value)}
						mix={[confirmPhrase(value)]}
					/>
				</div>
			);
		};
	},
);
