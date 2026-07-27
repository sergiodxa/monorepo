/**
 * A convenience wrapper composing a labeled, described, and validated date
 * field in one call: a caption through {@link Label}, a native
 * `<input type="date">` styled through {@link Input}, an optional supporting
 * passage through {@link Description}, and an optional validation message
 * through {@link FieldError}. Every id and `aria-describedby` relationship
 * between the parts is computed from this instance's own stable identifier,
 * leaving no id bookkeeping to the consumer.
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

/**
 * Prop types for {@link DateField}.
 */
export namespace DateField {
	/**
	 * Semantic color role for the control's keyboard focus ring, each mapped
	 * to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Per-part styling for the elements this convenience wrapper composes in
	 * one call, layered after each part's own built-in styling.
	 */
	export type PartsProps = FieldPartsProps;

	/**
	 * Props accepted by {@link DateField}. `mix` styles the root element
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
		/** Native `name` submitted with an enclosing form. */
		name?: string;
		/** Current value, in `YYYY-MM-DD` form, for a control a consumer tracks itself. */
		value?: string;
		/** Initial value, in `YYYY-MM-DD` form, for a control left to the platform's own uncontrolled state. */
		defaultValue?: string;
		/** Earliest accepted date, in `YYYY-MM-DD` form. */
		min?: string;
		/** Latest accepted date, in `YYYY-MM-DD` form. */
		max?: string;
		/** Granularity, in days, the control's value must fall on. */
		step?: number;
		/** Marks the control required for its enclosing form. */
		required?: boolean;
		/** Marks the control inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks the control's value fixed, while keeping it focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint, e.g. `"bday"`. */
		autoComplete?: string;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a complete date field in one call: a root element stacking
 * {@link Label}, a native `<input type="date">` rendered through
 * {@link Input}, and, when supplied, {@link Description} and
 * {@link FieldError} in a single column with a small gap between them. The
 * label's `for`, the control's `id`, and the control's `aria-describedby` are
 * all computed from this instance's own stable identifier, so the parts stay
 * correctly associated with no id bookkeeping left to the consumer.
 *
 * The date picker affordance, value parsing, and locale-aware formatting all
 * come from the platform's own `<input type="date">` implementation — this
 * component contributes the field's box styling, shared with every other
 * single-line control through {@link Input}, plus the label/description/error
 * composition and wiring. The control's keyboard focus ring reads `color`
 * (defaulting to `"neutral"`), and an invalid state — driven by
 * `errorMessage`'s presence, or an explicit `aria-invalid` override — recolors
 * both the border and ring to the semantic danger tone regardless of `color`.
 *
 * `min`/`max` bound the accepted range and `step` sets the granularity, in
 * days, the platform's own date picker and typed-entry validation enforce.
 * Composing {@link Label}, {@link Input}, {@link Description}, and
 * {@link FieldError} directly instead remains available for a field whose
 * wiring or layout this wrapper doesn't cover.
 *
 * @param handle Runtime handle carrying the root element's props and this instance's stable identifier.
 * @returns The render function producing the field's markup.
 * @example
 * <DateField label={t("form.birthday.label")} name="birthday" autoComplete="bday" />
 * @example
 * <DateField
 * 	label={t("form.startDate.label")}
 * 	name="startDate"
 * 	min="2026-01-01"
 * 	max="2026-12-31"
 * 	description={t("form.startDate.hint")}
 * />
 * @example
 * <DateField
 * 	label={t("form.dueDate.label")}
 * 	name="dueDate"
 * 	defaultValue="2026-07-20"
 * 	errorMessage={t("form.dueDate.pastDate")}
 * />
 */
export function DateField(handle: Handle<DateField.Props>) {
	return () => {
		let {
			color,
			label,
			description,
			errorMessage,
			name,
			value,
			defaultValue,
			min,
			max,
			step,
			required,
			disabled,
			readOnly,
			autoComplete,
			"aria-invalid": ariaInvalidProp,
			parts,
			mix,
			...rest
		} = handle.props;
		let { resolvedColor, resolvedInvalid, descriptionId, errorId, describedBy } =
			resolveFieldWiring(handle.id, {
				color,
				errorMessage,
				description,
				ariaInvalid: ariaInvalidProp,
			});

		return (
			<div {...rest} data-slot="date-field" mix={[fieldStackLayout(), mix]}>
				<Label htmlFor={handle.id} mix={parts?.label}>
					{label}
				</Label>
				<Input
					id={handle.id}
					type="date"
					name={name}
					value={value}
					defaultValue={defaultValue}
					min={min}
					max={max}
					step={step}
					required={required}
					disabled={disabled}
					readOnly={readOnly}
					autoComplete={autoComplete}
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
