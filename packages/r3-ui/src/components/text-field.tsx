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

import type { FieldPartsProps } from "../utils/field-parts";

import { fieldStackLayout } from "../styles/field-stack-layout";
import { resolveFieldWiring } from "../utils/resolve-field-wiring";

import { Description } from "./description";
import { FieldError } from "./field-error";
import { Input } from "./input";
import { Label } from "./label";

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
		 * control — after the description, when both are present — and
		 * referenced by the control's `aria-describedby`. Its presence alone
		 * marks the control's `aria-invalid`, unless `aria-invalid` is set
		 * explicitly.
		 */
		errorMessage?: RemixNode;
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
 * Renders a complete field in one call: a root element stacking
 * {@link Label}, an {@link Input} control, and, when supplied,
 * {@link Description} and {@link FieldError} in a single column with a small
 * gap between them. The label's `for`, the control's `id`, and the control's
 * `aria-describedby` are all computed from this instance's own stable
 * identifier, so the parts stay correctly associated with no id bookkeeping
 * left to the consumer.
 *
 * The control's keyboard focus ring reads `color` (defaulting to
 * `"neutral"`), and an invalid state — driven by `errorMessage`'s
 * presence, or an explicit `aria-invalid` override — recolors both the
 * border and ring to the semantic danger tone regardless of `color`; see
 * {@link Input} for the rest of the control's own styling contract.
 * Composing {@link Label}, {@link Input}, {@link Description}, and
 * {@link FieldError} directly instead remains available for a field whose
 * wiring or layout this wrapper doesn't cover.
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
			errorMessage,
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
					// The platform's own `type`/`role` correlation only narrows
					// correctly for a single literal `type` at the JSX call site;
					// `resolvedType` spans several of this field's supported
					// values, so the assignment below stays broader than that
					// narrowed contract on purpose.
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
