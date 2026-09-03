/**
 * A convenience wrapper composing a labeled, described, and validated field
 * in one call: a caption through {@link Label}, the control through
 * {@link Input}, an optional supporting passage through {@link Description},
 * and an optional validation message through {@link FieldError}. Every id
 * and `aria-describedby` relationship between the parts is computed from
 * this instance's own stable identifier, leaving no id bookkeeping to the
 * consumer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import type { FieldPartsProps } from "../utils/field-parts.js";

import { fieldStackLayout } from "../styles/field-stack-layout.js";
import { resolveFieldWiring } from "../utils/resolve-field-wiring.js";

import { Description } from "./description.js";
import { FieldError } from "./field-error.js";
import { resolveFieldIssue } from "./form.js";
import { Input } from "./input.js";
import { Label } from "./label.js";

/** Native `<input>` `type` {@link TextField} falls back to when `type` is omitted. */
const DEFAULT_TYPE: TextField.Type = "text";

/**
 * Prop types for {@link TextField}.
 */
export namespace TextField {
	/**
	 * Semantic color role for the control's keyboard focus ring, each mapped
	 * to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Native `<input>` `type` this wrapper renders a single-line, text-like
	 * control for. A checkbox, radio, or file control each has its own
	 * dedicated component instead of a `type` value here.
	 */
	export type Type = "text" | "email" | "password" | "tel" | "url" | "search" | "number";

	/**
	 * Per-part styling for the elements this convenience wrapper composes in
	 * one call, layered after each part's own built-in styling.
	 */
	export type PartsProps = FieldPartsProps;

	/**
	 * Props accepted by {@link TextField}. `mix` styles the root element
	 * grouping the field's parts; style the composed label, control,
	 * description, and error individually through `parts` instead.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Semantic color role for the control's focus ring. Defaults to `"neutral"` when omitted. */
		color?: Color;
		/**
		 * The field's caption, rendered through {@link Label} and associated
		 * with the control through a native `for`/`id` relationship computed
		 * from this instance's own identifier.
		 */
		label: RemixNode;
		/**
		 * Supporting copy rendered through {@link Description} beneath the
		 * control and referenced by the control's `aria-describedby`. Omit to
		 * render no description.
		 */
		description?: RemixNode;
		/**
		 * Validation message rendered through {@link FieldError} beneath the
		 * control, marking `aria-invalid` unless set explicitly. Falls back to
		 * a {@link Form}'s own `issues` message by `name`; an explicit value wins.
		 */
		errorMessage?: RemixNode;
		/**
		 * Native `autofocus`. Defaults to `true` for the first invalid field of
		 * an enclosing {@link Form}'s `issues`, landing keyboard focus on the
		 * problem with no client JavaScript; pass explicitly to override.
		 */
		autoFocus?: boolean;
		/** Native `<input>` `type`. Defaults to {@link DEFAULT_TYPE}. */
		type?: Type;
		/** Native `name` submitted with an enclosing form. */
		name?: string;
		/** Current value, for a control a consumer tracks itself. */
		value?: string;
		/** Initial value, for a control left to the platform's own uncontrolled state. */
		defaultValue?: string;
		/** Placeholder copy shown while the control is empty. */
		placeholder?: string;
		/** Marks the control required for its enclosing form. */
		required?: boolean;
		/** Marks the control inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks the control's value fixed, while keeping it focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint, e.g. `"email"` or `"current-password"`. */
		autoComplete?: string;
		/** Native validation pattern the control's value must match. */
		pattern?: string;
		/** Minimum accepted value length. */
		minLength?: number;
		/** Maximum accepted value length. */
		maxLength?: number;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Composes {@link Label}, {@link Input}, {@link Description}, and
 * {@link FieldError} into one field, computing every id and
 * `aria-describedby` link from this instance's own stable identifier.
 *
 * @param handle Runtime handle carrying the root element's props and this instance's stable identifier.
 * @returns The render function producing the field's markup.
 * @example
 * <TextField label={t("form.email.label")} type="email" name="email" required />
 * @example
 * <TextField
 * 	label={t("form.password.label")}
 * 	type="password"
 * 	name="password"
 * 	description={t("form.password.hint")}
 * />
 * @example
 * <TextField
 * 	label={t("form.username.label")}
 * 	name="username"
 * 	defaultValue="ab"
 * 	errorMessage={t("form.username.tooShort")}
 * />
 */
export function TextField(handle: Handle<TextField.Props>) {
	return () => {
		let {
			color,
			label,
			description,
			errorMessage: errorMessageProp,
			autoFocus,
			type,
			name,
			value,
			defaultValue,
			placeholder,
			required,
			disabled,
			readOnly,
			autoComplete,
			pattern,
			minLength,
			maxLength,
			"aria-invalid": ariaInvalidProp,
			parts,
			mix,
			...rest
		} = handle.props;
		let resolvedType = type ?? DEFAULT_TYPE;
		let { errorMessage, isFirstInvalid } = resolveFieldIssue(handle, name, errorMessageProp);
		let resolvedAutoFocus = autoFocus ?? (isFirstInvalid || undefined);
		let { resolvedColor, resolvedInvalid, descriptionId, errorId, describedBy } =
			resolveFieldWiring(handle.id, {
				color,
				errorMessage,
				description,
				ariaInvalid: ariaInvalidProp,
			});

		return (
			<div {...rest} data-slot="text-field" mix={[fieldStackLayout(), mix]}>
				<Label htmlFor={handle.id} mix={parts?.label}>
					{label}
				</Label>
				<Input
					id={handle.id}
					type={resolvedType as never}
					name={name}
					value={value}
					defaultValue={defaultValue}
					placeholder={placeholder}
					required={required}
					disabled={disabled}
					readOnly={readOnly}
					autoComplete={autoComplete}
					pattern={pattern}
					minLength={minLength}
					maxLength={maxLength}
					// oxlint-disable-next-line jsx-a11y/no-autofocus -- Not a focus grab on page load: this only ever resolves true for the first field an enclosing Form reports as invalid, so a failed submit lands the user on the problem instead of leaving them to hunt for it.
					autoFocus={resolvedAutoFocus}
					aria-invalid={resolvedInvalid}
					aria-describedby={describedBy}
					color={resolvedColor}
					mix={parts?.input}
				/>
				{description ? (
					<Description id={descriptionId} mix={parts?.description}>
						{description}
					</Description>
				) : null}
				{errorMessage ? (
					<FieldError id={errorId} mix={parts?.error}>
						{errorMessage}
					</FieldError>
				) : null}
			</div>
		);
	};
}
