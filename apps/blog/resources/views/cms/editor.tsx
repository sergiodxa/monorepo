/**
 * The pieces every CMS editor shares: a writing column that is only the title, a one-line
 * summary and the Markdown body, and a properties sidebar of small labelled fields that submit
 * with the column's form through its id, so the chrome frames the writing and never crowds it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Description, FieldError, Input, Label, TextArea } from "@sdxc/ui";
import { SaveBar } from "@sdxc/ui/app/save-bar";
import { StatusDot } from "@sdxc/ui/status-dot";

import { EmojiBodyField } from "~/resources/components/emoji-body-field";

/** Props accepted by {@link WritingColumn}. */
interface WritingColumnProps {
	/** The form's id, which the editor bar's buttons and the sidebar's fields submit with. */
	form: string;
	action: string;
	/** Whether the form updates a saved record, which the router reads from `_method=PUT`. */
	editing: boolean;
	title: { name: string; value: string; placeholder: string; label?: string };
	/** The one-line summary under the title, when the kind has one. */
	summary?: { name: string; value: string; placeholder: string; label: string };
	body: { name: string; value: string; placeholder: string; label: string };
	/** What the floating bar's Save says once the form is dirty. */
	saveLabel: string;
	/** Fields the column carries without showing, such as a hidden id. */
	hidden?: RemixNode;
}

/**
 * The writing surface: a large title, a quiet summary and a Markdown body that grows with what
 * is written. The title input keeps the id `title`, which the teaser counter reads.
 */
export function WritingColumn(handle: Handle<WritingColumnProps>) {
	return () => {
		let { form, action, editing, title, summary, body, saveLabel, hidden } = handle.props;
		let bare = raw({
			border: "none",
			background: "transparent",
			padding: "0",
			outline: "none",
			inlineSize: "100%",
		});

		return (
			<form
				id={form}
				method="post"
				action={action}
				mix={[vstack({ gap: 4, align: "stretch" }), raw({ paddingBlock: "1.5rem 4rem" })]}
			>
				{editing ? <input type="hidden" name="_method" value="PUT" /> : null}
				{hidden}
				<label htmlFor="title" mix={[visuallyHidden()]}>
					{title.label ?? "Title"}
				</label>
				<input
					id="title"
					name={title.name}
					defaultValue={title.value}
					placeholder={title.placeholder}
					required
					autoComplete="off"
					mix={[
						bare,
						fg("neutral.emphasis"),
						raw({
							fontSize: "clamp(1.625rem, 1.3rem + 1.4vw, 2.25rem)",
							fontWeight: "650",
							letterSpacing: "-0.015em",
							lineHeight: "1.2",
						}),
					]}
				/>
				{summary ? (
					<input
						name={summary.name}
						aria-label={summary.label}
						defaultValue={summary.value}
						placeholder={summary.placeholder}
						autoComplete="off"
						mix={[bare, fg("neutral.muted"), raw({ fontSize: "1.0625rem" })]}
					/>
				) : null}
				<hr
					mix={[
						m(0),
						raw({
							border: "none",
							blockSize: "1px",
							inlineSize: "3rem",
							backgroundColor: "var(--ui-neutral-border)",
						}),
					]}
				/>
				<EmojiBodyField
					name={body.name}
					label={body.label}
					placeholder={body.placeholder}
					value={body.value}
				/>
				<SaveBar
					labels={{
						message: "Unsaved changes",
						discard: "Discard",
						save: saveLabel,
						shortcut: "⌘S",
					}}
				/>
			</form>
		);
	};
}

/** Props accepted by {@link SidebarSection}. */
interface SidebarSectionProps {
	title: string;
	children: RemixNode;
}

/** A titled group of properties in the editor's sidebar. */
export function SidebarSection(handle: Handle<SidebarSectionProps>) {
	return () => (
		<section mix={[vstack({ gap: 3, align: "stretch" })]}>
			<h2 mix={[m(0), text("xs"), weight("semibold"), fg("neutral.muted")]}>
				{handle.props.title}
			</h2>
			{handle.props.children}
		</section>
	);
}

/** Props accepted by {@link SidebarField}. */
interface SidebarFieldProps {
	/** The form the field submits with. */
	form: string;
	id: string;
	name: string;
	label: string;
	value: string;
	type?: "text" | "date" | "url";
	description?: RemixNode;
	error?: string;
	required?: boolean;
	readOnly?: boolean;
	placeholder?: string;
	/** Draws a multi-line field. */
	rows?: number;
}

/** One labelled property, submitted with the writing column's form. */
export function SidebarField(handle: Handle<SidebarFieldProps>) {
	return () => {
		let { form, id, name, label, value, type = "text", description, error, rows } = handle.props;
		let describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
			.filter(Boolean)
			.join(" ");
		let ariaDescribedBy = describedBy || undefined;
		let ariaInvalid = error ? ("true" as const) : undefined;

		return (
			<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
				<Label htmlFor={id}>{label}</Label>
				{rows === undefined ? (
					<SidebarInput
						type={type}
						id={id}
						name={name}
						form={form}
						defaultValue={value}
						required={handle.props.required}
						readOnly={handle.props.readOnly}
						placeholder={handle.props.placeholder}
						aria-describedby={ariaDescribedBy}
						aria-invalid={ariaInvalid}
					/>
				) : (
					<TextArea
						id={id}
						name={name}
						form={form}
						rows={rows}
						defaultValue={value}
						required={handle.props.required}
						readOnly={handle.props.readOnly}
						placeholder={handle.props.placeholder}
						aria-describedby={ariaDescribedBy}
						aria-invalid={ariaInvalid}
					/>
				)}
				{description ? <Description id={`${id}-description`}>{description}</Description> : null}
				{error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
			</div>
		);
	};
}

/** Props accepted by {@link SidebarInput}: the attributes a property input takes. */
interface SidebarInputProps {
	type: "text" | "date" | "url";
	id: string;
	name: string;
	form: string;
	defaultValue: string;
	required?: boolean;
	readOnly?: boolean;
	placeholder?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: "true";
}

/** A single-line property input, typed as text, a date or a URL. */
function SidebarInput(handle: Handle<SidebarInputProps>) {
	return () => {
		let { type, ...attributes } = handle.props;
		if (type === "date") return <Input {...attributes} type="date" />;
		if (type === "url") return <Input {...attributes} type="url" />;
		return <Input {...attributes} type="text" />;
	};
}

/**
 * Whether a date input's value is still ahead of today, which makes the post a scheduled one;
 * an empty value publishes on save.
 *
 * @param value The `published_at` field, `YYYY-MM-DD` or empty.
 */
export function isScheduled(value: string): boolean {
	return value !== "" && value > new Date().toISOString().slice(0, 10);
}

/**
 * The editor bar's quiet state: refused, live or scheduled once saved, or not saved yet.
 *
 * @param editing Whether the post is saved.
 * @param scheduled Whether its publish date is still ahead.
 * @param refused Whether the last save was refused.
 */
export function editorStatus(editing: boolean, scheduled: boolean, refused: boolean) {
	if (refused) return <StatusDot color="danger">Not saved</StatusDot>;
	if (!editing) return <StatusDot color="neutral">Not saved yet</StatusDot>;
	return (
		<StatusDot color={scheduled ? "warning" : "success"}>
			{scheduled ? "Scheduled" : "Published"}
		</StatusDot>
	);
}
